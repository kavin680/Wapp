/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  Logger,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { AuthService } from '../auth/auth.service';
import { MessagingService } from '../messaging/messaging.service';
import { ContactsService } from '../contacts/contacts.service';
import { ConversationsService } from '../conversations/conversations.service';
import { TemplatesService } from '../templates/templates.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { MediaService } from '../media/media.service';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../../database/prisma.service';

interface AdminSession {
  userId?: string;
  email?: string;
  role?: string;
  accessToken?: string;
}

@ApiExcludeController()
@Controller({ path: 'admin', version: VERSION_NEUTRAL })
@Public()
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly messagingService: MessagingService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly templatesService: TemplatesService,
    private readonly campaignsService: CampaignsService,
    private readonly mediaService: MediaService,
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getSession(req: any): AdminSession {
    return (req.session?.admin as AdminSession) || {};
  }

  private setSession(req: any, admin: AdminSession): void {
    req.session.admin = admin;
  }

  private clearSession(req: any): void {
    delete req.session.admin;
  }

  private isAuthenticated(req: any): boolean {
    const session = this.getSession(req);
    return !!session?.userId;
  }

  private formatDate(date: Date | string | null): string {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  @Get('login')
  loginPage(@Req() req: any, @Res() res: any) {
    if (this.isAuthenticated(req)) return res.redirect('/admin');
    return res.render('login', { layout: 'layouts/main', title: 'Login' });
  }

  @Post('login')
  async loginSubmit(
    @Req() req: any,
    @Res() res: any,
    @Body() body: { email: string; password: string },
  ) {
    try {
      const result = await this.authService.login(
        { email: body.email, password: body.password },
        req.ip,
        req.headers['user-agent'],
      );
      this.setSession(req, {
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
        accessToken: result.accessToken,
      });
      return res.redirect('/admin');
    } catch {
      return res.render('login', {
        layout: 'layouts/main',
        title: 'Login',
        error: 'Invalid email or password',
        email: body.email,
      });
    }
  }

  @Get('logout')
  async logout(@Req() req: any, @Res() res: any) {
    const session = this.getSession(req);
    if (session.userId) {
      try {
        await this.authService.logout(session.userId);
      } catch {
        // ignore
      }
    }
    this.clearSession(req);
    return res.redirect('/admin/login');
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get()
  async dashboard(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    try {
      const [
        totalMessages,
        totalContacts,
        totalCampaigns,
        totalProviders,
        totalTemplates,
        totalConversations,
      ] = await Promise.all([
        this.prisma.message.count({ where: { userId: session.userId } }),
        this.prisma.contact.count({
          where: { userId: session.userId, deletedAt: null },
        }),
        this.prisma.campaign.count({ where: { userId: session.userId } }),
        this.prisma.messagingProvider.count(),
        this.prisma.template.count(),
        this.prisma.conversation.count({ where: { userId: session.userId } }),
      ]);

      const recentMessages = await this.getRecentMessages(session.userId!);

      return res.render('dashboard', {
        layout: 'layouts/main',
        title: 'Dashboard',
        user: { email: session.email, role: session.role },
        flash: req.query?.flash,
        stats: {
          totalMessages,
          totalContacts,
          totalCampaigns,
          totalProviders,
          totalTemplates,
          totalConversations,
        },
        recentMessages,
      });
    } catch (error) {
      this.logger.error('Dashboard error', (error as Error).stack);
      return res.render('dashboard', {
        layout: 'layouts/main',
        title: 'Dashboard',
        user: { email: session.email, role: session.role },
        stats: {
          totalMessages: 0,
          totalContacts: 0,
          totalCampaigns: 0,
          totalProviders: 0,
          totalTemplates: 0,
          totalConversations: 0,
        },
        recentMessages: [],
      });
    }
  }

  // ─── Providers ────────────────────────────────────────────────────────────

  @Get('providers')
  async providersPage(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    const result = await this.messagingService.findAllProviders({
      page: 1,
      limit: 100,
    });
    const providers = (result.data || []).map((p: any) => ({
      ...p,
      createdAt: this.formatDate(p.createdAt),
    }));

    return res.render('providers', {
      layout: 'layouts/main',
      title: 'Providers',
      user: { email: session.email, role: session.role },
      providers,
      flash: req.query?.flash,
      error: req.query?.error,
    });
  }

  @Post('providers')
  async createProvider(
    @Req() req: any,
    @Res() res: any,
    @Body()
    body: { name: string; type: string; channel: string; description?: string },
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    try {
      await this.messagingService.createProvider({
        name: body.name,
        type: body.type as any,
        description: body.description,
        isActive: true,
      });
      return res.redirect(
        '/admin/providers?flash=Provider created successfully',
      );
    } catch (error) {
      return res.redirect(
        `/admin/providers?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('providers/:id/toggle')
  async toggleProvider(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    try {
      const provider = await this.messagingService.findProviderById(id);
      await this.messagingService.updateProvider(id, {
        isActive: !provider.isActive,
      });
      return res.redirect('/admin/providers?flash=Provider status updated');
    } catch (error) {
      return res.redirect(
        `/admin/providers?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('providers/:id/configure')
  async configureProvider(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
    @Body()
    body: {
      apiToken?: string;
      phoneNumberId?: string;
      businessAccountId?: string;
      webhookSecret?: string;
    },
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      const credentials: Record<string, string> = {};
      if (body.apiToken) credentials.apiToken = body.apiToken;
      if (body.webhookSecret)
        credentials.webhookVerifyToken = body.webhookSecret;

      await this.messagingService.configureProvider(id, session.userId!, {
        credentials: Object.keys(credentials).length > 0 ? credentials : {},
        phoneNumberId: body.phoneNumberId,
        businessAccountId: body.businessAccountId,
      });
      return res.redirect(
        '/admin/providers?flash=Provider configured successfully',
      );
    } catch (error) {
      return res.redirect(
        `/admin/providers?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  @Get('contacts')
  async contactsPage(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    const result = await this.contactsService.findAll(session.userId!, {
      page: 1,
      limit: 100,
    });
    const contacts = (result.data || []).map((c: any) => ({
      ...c,
      phone: c.phoneNumber,
      channel: 'WHATSAPP',
      optedIn: c.optInStatus === 'OPTED_IN',
      createdAt: this.formatDate(c.createdAt),
    }));

    return res.render('contacts', {
      layout: 'layouts/main',
      title: 'Contacts',
      user: { email: session.email, role: session.role },
      contacts,
      flash: req.query?.flash,
      error: req.query?.error,
    });
  }

  @Post('contacts')
  async createContact(
    @Req() req: any,
    @Res() res: any,
    @Body()
    body: {
      firstName: string;
      lastName?: string;
      phone: string;
      email?: string;
      channel?: string;
      externalId?: string;
    },
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      await this.contactsService.create(
        {
          phoneNumber: body.phone,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          displayName: `${body.firstName} ${body.lastName || ''}`.trim(),
          optInStatus: 'OPTED_IN' as any,
        },
        session.userId!,
      );
      return res.redirect('/admin/contacts?flash=Contact added successfully');
    } catch (error) {
      return res.redirect(
        `/admin/contacts?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('contacts/:id/toggle-optin')
  async toggleOptIn(@Req() req: any, @Res() res: any, @Param('id') id: string) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      const contact = await this.contactsService.findOne(id, session.userId!);
      const newStatus =
        contact.optInStatus === 'OPTED_IN' ? 'OPTED_OUT' : 'OPTED_IN';
      await this.contactsService.update(id, session.userId!, {
        optInStatus: newStatus as any,
      });
      return res.redirect(
        '/admin/contacts?flash=Contact opt-in status updated',
      );
    } catch (error) {
      return res.redirect(
        `/admin/contacts?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('contacts/:id/delete')
  async deleteContact(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      await this.contactsService.remove(id, session.userId!);
      return res.redirect('/admin/contacts?flash=Contact deleted');
    } catch (error) {
      return res.redirect(
        `/admin/contacts?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  @Get('messages')
  async messagesPage(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    const providersResult = await this.messagingService.findAllProviders({
      page: 1,
      limit: 100,
    });
    const messages = await this.getRecentMessages(session.userId!, 50);

    return res.render('messages', {
      layout: 'layouts/main',
      title: 'Messages',
      user: { email: session.email, role: session.role },
      providers: providersResult.data || [],
      messages,
      flash: req.query?.flash,
      error: req.query?.error,
    });
  }

  @Post('messages/send')
  async sendMessage(
    @Req() req: any,
    @Res() res: any,
    @Body() body: { providerId: string; to: string; content: string },
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      await this.messagingService.sendMessage(
        {
          providerId: body.providerId,
          to: body.to,
          type: 'text' as any,
          content: { body: body.content },
        },
        session.userId!,
      );
      return res.redirect('/admin/messages?flash=Message sent successfully');
    } catch (error) {
      return res.redirect(
        `/admin/messages?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  // ─── Conversations ────────────────────────────────────────────────────────

  @Get('conversations')
  async conversationsPage(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    const result = await this.conversationsService.findAll(session.userId!, {
      page: 1,
      limit: 100,
    });
    const conversations = (result.data || []).map((c: any) => {
      const contact = c.contact;
      const messages = c.messages;
      const count = c._count;
      return {
        ...c,
        contactPhone: contact?.phoneNumber || contact?.displayName || 'Unknown',
        channel: c.channel || 'WHATSAPP',
        lastMessage: messages?.[0]?.content
          ? (messages[0].content?.body || JSON.stringify(messages[0].content))
              .toString()
              .substring(0, 80)
          : '—',
        messageCount: count?.messages || 0,
        updatedAt: this.formatDate(c.updatedAt),
      };
    });

    return res.render('conversations', {
      layout: 'layouts/main',
      title: 'Conversations',
      user: { email: session.email, role: session.role },
      conversations,
    });
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  @Get('templates')
  async templatesPage(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    const result = await this.templatesService.findAll({ page: 1, limit: 100 });
    const templates = (result.data || []).map((t: any) => ({
      ...t,
      createdAt: this.formatDate(t.createdAt),
    }));

    return res.render('templates', {
      layout: 'layouts/main',
      title: 'Templates',
      user: { email: session.email, role: session.role },
      templates,
      flash: req.query?.flash,
      error: req.query?.error,
    });
  }

  @Post('templates')
  async createTemplate(
    @Req() req: any,
    @Res() res: any,
    @Body()
    body: {
      name: string;
      channel: string;
      category: string;
      language: string;
      content: string;
    },
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    try {
      const providersResult = await this.messagingService.findAllProviders({
        page: 1,
        limit: 1,
      });
      const firstProvider = (providersResult.data || [])[0];
      if (!firstProvider) {
        return res.redirect('/admin/templates?error=Create a provider first');
      }

      await this.templatesService.create({
        providerId: (firstProvider as any).id,
        name: body.name,
        channel: body.channel as any,
        category: body.category as any,
        language: body.language || 'en',
        bodyContent: body.content,
      });
      return res.redirect(
        '/admin/templates?flash=Template created successfully',
      );
    } catch (error) {
      return res.redirect(
        `/admin/templates?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('templates/:id/delete')
  async deleteTemplate(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    try {
      await this.templatesService.remove(id);
      return res.redirect('/admin/templates?flash=Template deleted');
    } catch (error) {
      return res.redirect(
        `/admin/templates?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  // ─── Campaigns ────────────────────────────────────────────────────────────

  @Get('campaigns')
  async campaignsPage(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    const providersResult = await this.messagingService.findAllProviders({
      page: 1,
      limit: 100,
    });
    const result = await this.campaignsService.findAll(session.userId!, {
      page: 1,
      limit: 100,
    });
    const campaigns = (result.data || []).map((c: any) => ({
      ...c,
      channel: c.provider?.type || 'WHATSAPP',
      recipientCount: c._count?.recipients || c.totalRecipients || 0,
      scheduledAt: this.formatDate(c.scheduledAt),
    }));

    return res.render('campaigns', {
      layout: 'layouts/main',
      title: 'Campaigns',
      user: { email: session.email, role: session.role },
      providers: providersResult.data || [],
      campaigns,
      flash: req.query?.flash,
      error: req.query?.error,
    });
  }

  @Post('campaigns')
  async createCampaign(
    @Req() req: any,
    @Res() res: any,
    @Body()
    body: {
      name: string;
      providerId: string;
      content: string;
      scheduledAt?: string;
    },
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      await this.campaignsService.create(
        {
          name: body.name,
          providerId: body.providerId,
          channel: 'WHATSAPP' as any,
          scheduledAt: body.scheduledAt || undefined,
          metadata: { message: body.content },
        },
        session.userId!,
      );
      return res.redirect(
        '/admin/campaigns?flash=Campaign created successfully',
      );
    } catch (error) {
      return res.redirect(
        `/admin/campaigns?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('campaigns/:id/start')
  async startCampaign(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      await this.campaignsService.start(id, session.userId!);
      return res.redirect('/admin/campaigns?flash=Campaign started');
    } catch (error) {
      return res.redirect(
        `/admin/campaigns?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('campaigns/:id/pause')
  async pauseCampaign(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      await this.campaignsService.pause(id, session.userId!);
      return res.redirect('/admin/campaigns?flash=Campaign paused');
    } catch (error) {
      return res.redirect(
        `/admin/campaigns?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('campaigns/:id/resume')
  async resumeCampaign(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      await this.campaignsService.start(id, session.userId!);
      return res.redirect('/admin/campaigns?flash=Campaign resumed');
    } catch (error) {
      return res.redirect(
        `/admin/campaigns?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('campaigns/:id/cancel')
  async cancelCampaign(
    @Req() req: any,
    @Res() res: any,
    @Param('id') id: string,
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);
    try {
      await this.campaignsService.cancel(id, session.userId!);
      return res.redirect('/admin/campaigns?flash=Campaign cancelled');
    } catch (error) {
      return res.redirect(
        `/admin/campaigns?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  // ─── Media ────────────────────────────────────────────────────────────────

  @Get('media')
  async mediaPage(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    const result = await this.mediaService.findAll({ page: 1, limit: 100 });
    const media = (result.data || []).map((m: any) => ({
      ...m,
      sizeFormatted: this.formatBytes(m.size || 0),
      channel: 'WHATSAPP',
      createdAt: this.formatDate(m.createdAt),
    }));

    return res.render('media', {
      layout: 'layouts/main',
      title: 'Media',
      user: { email: session.email, role: session.role },
      media,
      flash: req.query?.flash,
      error: req.query?.error,
    });
  }

  @Post('media/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @Req() req: any,
    @Res() res: any,
    @UploadedFile() file: any,
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    try {
      if (!file) {
        return res.redirect('/admin/media?error=No file selected');
      }
      const type = file.mimetype.startsWith('image/')
        ? 'IMAGE'
        : file.mimetype.startsWith('video/')
          ? 'VIDEO'
          : file.mimetype.startsWith('audio/')
            ? 'AUDIO'
            : 'DOCUMENT';
      await this.mediaService.upload(
        {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        },
        type,
      );
      return res.redirect('/admin/media?flash=File uploaded successfully');
    } catch (error) {
      return res.redirect(
        `/admin/media?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  @Post('media/:id/delete')
  async deleteMedia(@Req() req: any, @Res() res: any, @Param('id') id: string) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    try {
      await this.mediaService.remove(id);
      return res.redirect('/admin/media?flash=Media deleted');
    } catch (error) {
      return res.redirect(
        `/admin/media?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  @Get('settings')
  async settingsPage(@Req() req: any, @Res() res: any) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    const session = this.getSession(req);

    const [settings, preferences] = await Promise.all([
      this.settingsService.findAll(),
      this.settingsService.getUserPreferences(session.userId!),
    ]);

    const formattedSettings = settings.map((s: any) => ({
      ...s,
      value:
        typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value),
      updatedAt: this.formatDate(s.updatedAt),
    }));

    const formattedPrefs = preferences.map((p: any) => ({
      ...p,
      value:
        typeof p.value === 'object' ? JSON.stringify(p.value) : String(p.value),
      updatedAt: this.formatDate(p.updatedAt),
    }));

    return res.render('settings', {
      layout: 'layouts/main',
      title: 'Settings',
      user: { email: session.email, role: session.role },
      settings: formattedSettings,
      preferences: formattedPrefs,
      flash: req.query?.flash,
      error: req.query?.error,
    });
  }

  @Post('settings')
  async createSetting(
    @Req() req: any,
    @Res() res: any,
    @Body() body: { key: string; value: string; category: string },
  ) {
    if (!this.isAuthenticated(req)) return res.redirect('/admin/login');
    try {
      await this.settingsService.create({
        key: body.key,
        value: body.value,
        category: body.category || 'general',
      });
      return res.redirect('/admin/settings?flash=Setting saved');
    } catch (error) {
      return res.redirect(
        `/admin/settings?error=${encodeURIComponent((error as Error).message)}`,
      );
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async getRecentMessages(userId: string, take = 10): Promise<any[]> {
    try {
      const messages = await this.prisma.message.findMany({
        where: { userId },
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            include: {
              contact: {
                select: { phoneNumber: true },
              },
            },
          },
        },
      });
      return messages.map((m) => ({
        to: (m as any).conversation?.contact?.phoneNumber || 'Unknown',
        channel: (m as any).conversation?.channel || 'WHATSAPP',
        content: m.content
          ? ((m.content as any)?.body || JSON.stringify(m.content))
              .toString()
              .substring(0, 60)
          : '—',
        direction: m.direction,
        status: m.failedAt
          ? 'FAILED'
          : m.deliveredAt
            ? 'DELIVERED'
            : m.sentAt
              ? 'SENT'
              : 'PENDING',
        createdAt: this.formatDate(m.createdAt),
      }));
    } catch {
      return [];
    }
  }
}
