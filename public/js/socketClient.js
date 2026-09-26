const Net = (() => {
  let socket;

  function init(onReady) {
    socket = io();
    let ready = false;

    // Re-join after every reconnect (e.g. a server restart), otherwise the
    // server forgets who this socket is and other players stop seeing us.
    socket.on('connect', () => socket.emit('join'));

    socket.on('connect_error', err => {
      if (err && err.message === 'unauthorized') window.location.reload();
    });

    socket.on('joined', data => {
      State.player = normalizePlayer(data.player);
      State.playerId = data.player.id;
      State.catalog = data.catalog;
      State.listings = data.listings;
      if (!ready) {
        ready = true;
        onReady();
      } else {
        UI.renderAll();
      }
    });

    socket.on('playerUpdated', p => {
      State.player = normalizePlayer(p);
      UI.renderAll();
    });

    socket.on('listingsUpdated', listings => {
      State.listings = listings;
      UI.renderAll();
    });

    socket.on('onlinePlayers', players => {
      State.onlinePlayers = players;
      UI.renderOnlinePlayers();
    });

    socket.on('worldPlayers', players => {
      State.onlinePlayers = players;
      UI.renderOnlinePlayers();
    });

    socket.on('worldChat', message => {
      State.chatMessages.push({ ...message, receivedAt: Date.now() });
      State.chatMessages = State.chatMessages.slice(-30);
      World.renderChat();
    });

    socket.on('itemSold', data => {
      UI.toast(`💸 ${data.buyer} bought your "${data.name}" for ${data.price} creds!`);
    });

    socket.on('actionError', data => {
      UI.toast(data.message);
    });

    socket.on('notice', data => UI.toast(data.message));

    socket.on('social', data => {
      State.social = data;
      if (State.player) Social.render();
    });

    socket.on('dm', msg => Social.onDm(msg));

    socket.on('party', party => {
      State.party = party;
      if (State.player) {
        Social.render();
        Battle.render();
      }
    });

    socket.on('partyFight', data => Battle.onTeamFight(data));
    socket.on('partyFightEnd', data => Battle.onTeamFightEnd(data));
  }

  function normalizePlayer(p) {
    p.inventory = p.inventory || { weapons: [], powerups: [] };
    p.equipped = p.equipped || { weapons: [], powerups: [] };
    p.builtItems = p.builtItems || [];
    p.home = p.home || { houseBuildId: null, art: [], furniture: [] };
    p.home.art = p.home.art || [];
    p.home.furniture = p.home.furniture || [];
    p.vehicleBuildId = p.vehicleBuildId || null;
    p.world = p.world || { x: 400, y: 300, homeX: 125, homeY: 155 };
    p.hunt = p.hunt || { level: 1, runCred: 0, inFight: false };
    return p;
  }

  function syncPlayer() {
    socket.emit('syncPlayer', {
      cred: State.player.cred,
      lifetimeCred: State.player.lifetimeCred,
      inventory: State.player.inventory,
      equipped: State.player.equipped,
      builtItems: State.player.builtItems,
      home: State.player.home,
      vehicleBuildId: State.player.vehicleBuildId,
      hunt: State.player.hunt
    });
  }

  function buyItem(itemId, kind) {
    socket.emit('buyItem', { itemId, kind });
  }

  function listBuild(build, price) {
    socket.emit('listBuild', { build: { id: build.id, price } });
  }

  function cancelListing(listingId) {
    socket.emit('cancelListing', { listingId });
  }

  function buyListing(listingId) {
    socket.emit('buyListing', { listingId });
  }

  function moveWorld(x, y) {
    socket.emit('worldMove', { x, y });
  }

  function placeHome(x, y) {
    socket.emit('placeHome', { x, y });
  }

  function chat(message) {
    socket.emit('worldChat', message);
  }

  const send = (event, payload) => socket.emit(event, payload);
  const social = {
    friendRequest: (targetId, name) => send('friendRequest', { targetId, name }),
    friendRespond: (fromId, accept) => send('friendRespond', { fromId, accept }),
    friendRemove: friendId => send('friendRemove', { friendId }),
    dmSend: (to, message) => send('dmSend', { to, message }),
    dmHistory: (withId, cb) => socket.emit('dmHistory', { with: withId }, cb),
    gift: (to, kind, itemId, amount) => send('giftSend', { to, kind, itemId, amount }),
    offer: (to, kind, itemId, price) => send('offerSend', { to, kind, itemId, price }),
    offerRespond: (offerId, accept) => send('offerRespond', { offerId, accept }),
    offerCancel: offerId => send('offerCancel', { offerId }),
    partyInvite: to => send('partyInvite', { to }),
    partyAccept: partyId => send('partyAccept', { partyId }),
    partyDecline: partyId => send('partyDecline', { partyId }),
    partyLeave: () => send('partyLeave'),
    partyFightStart: () => send('partyFightStart'),
    partyHit: mode => send('partyHit', { mode })
  };

  return { init, syncPlayer, buyItem, listBuild, cancelListing, buyListing, moveWorld, placeHome, chat, social };
})();
