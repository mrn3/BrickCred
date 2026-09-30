document.addEventListener('DOMContentLoaded', () => {
  UI.initTabs();

  function startHomeIncome() {
    setInterval(() => {
      const stats = getHomeStats(State.player);
      if (!stats.house) return;
      State.player.cred += stats.income;
      State.player.lifetimeCred += stats.income;
      Net.syncPlayer();
      UI.renderAll();
      UI.toast(`🏠 Your home earned you ${stats.income} creds.`);
    }, 60000);
  }

  function startGame(account) {
    State.account = account;
    initProfile();
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.classList.remove('hidden');
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.reload();
    });
    Net.init(() => {
      World.init();
      BuildStudio.init();
      Home.init();
      Battle.init();
      Social.init();
      UI.initMarketControls();
      UI.renderAll();
      startHomeIncome();
    });
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  function initProfile() {
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordForm');
    const displayName = document.getElementById('profileDisplayName');
    const username = document.getElementById('profileUsername');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const profileError = document.getElementById('profileError');
    const passwordError = document.getElementById('passwordError');
    const passwordNote = document.getElementById('passwordNote');

    const render = () => {
      displayName.value = State.account.name || '';
      username.value = State.account.username || '';
      document.getElementById('profileEmail').textContent = State.account.email
        ? `Account email (managed by your sign-in provider): ${State.account.email}`
        : 'No email address is attached to this account.';
      currentPassword.required = State.account.hasPassword;
      document.getElementById('passwordSave').disabled = !State.account.username;
      passwordNote.textContent = State.account.hasPassword
        ? 'Enter your current password to change it.'
        : State.account.username
          ? 'No password is set. Choose one to enable username and password sign-in.'
          : 'Set a username above before adding a password.';
    };

    profileForm.addEventListener('submit', async event => {
      event.preventDefault();
      profileError.textContent = '';
      const button = document.getElementById('profileSave');
      button.disabled = true;
      try {
        const result = await postJson('/api/profile', {
          name: displayName.value.trim(),
          username: username.value.trim()
        });
        State.account = result.user;
        State.player.name = result.user.name;
        UI.renderAll();
        render();
        UI.toast('Profile updated.');
      } catch (error) {
        profileError.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });

    passwordForm.addEventListener('submit', async event => {
      event.preventDefault();
      passwordError.textContent = '';
      if (newPassword.value !== confirmPassword.value) {
        passwordError.textContent = 'The new passwords do not match.';
        return;
      }
      const button = document.getElementById('passwordSave');
      button.disabled = true;
      try {
        const result = await postJson('/api/password', {
          currentPassword: currentPassword.value,
          newPassword: newPassword.value
        });
        State.account = result.user;
        passwordForm.reset();
        render();
        UI.toast('Password updated.');
      } catch (error) {
        passwordError.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });

    render();
  }

  function showAuth() {
    const modal = document.getElementById('authModal');
    const form = document.getElementById('authForm');
    const username = document.getElementById('authUsername');
    const password = document.getElementById('authPassword');
    const error = document.getElementById('authError');
    const submit = document.getElementById('authSubmit');
    const legacyId = localStorage.getItem('lego_player_id');
    let mode = 'login';

    // Pre-account progress is offered to the first account created in this browser.
    const clearLegacy = () => {
      localStorage.removeItem('lego_player_id');
      localStorage.removeItem('lego_player_name');
    };

    const finish = account => {
      modal.classList.add('hidden');
      startGame(account);
    };

    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.mode;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t === tab));
        submit.textContent = mode === 'login' ? 'Log In' : 'Create Account';
        password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
        error.textContent = '';
      });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      error.textContent = '';
      submit.disabled = true;
      try {
        const body = { username: username.value.trim(), password: password.value };
        if (mode === 'register') body.legacyId = legacyId;
        const result = await postJson(mode === 'login' ? '/api/login' : '/api/register', body);
        if (mode === 'register') clearLegacy();
        finish(result.user);
      } catch (err) {
        error.textContent = err.message;
      } finally {
        submit.disabled = false;
      }
    });

    fetch('/api/config').then(r => r.json()).then(({ googleClientId }) => {
      if (!googleClientId) return;
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            error.textContent = '';
            try {
              const result = await postJson('/api/google', { credential, legacyId });
              clearLegacy();
              finish(result.user);
            } catch (err) {
              error.textContent = err.message;
            }
          }
        });
        google.accounts.id.renderButton(document.getElementById('googleButton'), { theme: 'outline', size: 'large' });
        document.getElementById('googleArea').classList.remove('hidden');
      };
      document.head.appendChild(script);
    });

    modal.classList.remove('hidden');
    username.focus();
  }

  fetch('/api/me').then(async res => {
    if (!res.ok) return showAuth();
    const result = await res.json();
    startGame(result.user);
  }).catch(showAuth);
});
