// Modal helpers
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function openConfigModal(providerId, providerName) {
  document.getElementById('configProviderId').value = providerId;
  document.getElementById('configProviderName').textContent = providerName;
  document.getElementById('configForm').action = '/admin/providers/' + providerId + '/configure';
  openModal('configProviderModal');
}

// Close modals on backdrop click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('active');
  }
});

// Close modals on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.active').forEach(function(m) {
      m.classList.remove('active');
    });
  }
});

// Auto-hide alerts after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    document.querySelectorAll('.alert').forEach(function(alert) {
      alert.style.transition = 'opacity 0.5s';
      alert.style.opacity = '0';
      setTimeout(function() { alert.remove(); }, 500);
    });
  }, 5000);
});
