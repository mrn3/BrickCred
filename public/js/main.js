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

  function startGame() {
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

    const finish = () => {
      modal.classList.add('hidden');
      startGame();
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
        await postJson(mode === 'login' ? '/api/login' : '/api/register', body);
        if (mode === 'register') clearLegacy();
        finish();
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
              await postJson('/api/google', { credential, legacyId });
              clearLegacy();
              finish();
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

  fetch('/api/me').then(res => (res.ok ? startGame() : showAuth())).catch(showAuth);
});
