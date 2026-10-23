// DIH Token Dashboard — ethers.js v6, Ethereum Sepolia only.
(function () {
  "use strict";

  var CONFIG = {
    chainId: 11155111n,
    chainHex: "0xaa36a7",
    explorer: "https://sepolia.etherscan.io",
    lecturer: "0x5f3046bD5aA3c6d4575AF09B8198d584f130708E",
    tokens: [
      { address: "0x05DB1441d06eC94E89d43ee834B216986a476c7B", note: "My token" },
      { address: "0x991C9ad3c61281714b16F3713Cf8def01b3133cE", note: "Classmate's token" }
    ]
  };

  var ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)"
  ];

  var provider = null;   // ethers.BrowserProvider
  var account = null;    // checksummed address
  var onSepolia = false;
  var busy = false;
  // per-token state: { address, note, name, symbol, decimals, supply, balance, error }
  var tokens = CONFIG.tokens.map(function (t) { return { address: t.address, note: t.note }; });

  var $ = function (id) { return document.getElementById(id); };

  // ---------- helpers ----------
  function show(id, kind, html) {
    var el = $(id);
    if (!html) { el.hidden = true; el.innerHTML = ""; return; }
    el.className = "msg " + kind;
    el.innerHTML = html;
    el.hidden = false;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function short(a) { return a.slice(0, 6) + "…" + a.slice(-4); }
  function txLink(hash, text) {
    return "<a href='" + CONFIG.explorer + "/tx/" + hash + "' target='_blank' rel='noopener'>" + esc(text || "Etherscan ↗") + "</a>";
  }
  function fmt(raw, decimals) {
    var s = ethers.formatUnits(raw, decimals);           // "1234.5" / "1000000.0"
    var parts = s.split(".");
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var frac = (parts[1] || "").replace(/0+$/, "").slice(0, 6);
    return frac ? whole + "." + frac : whole;
  }
  function isRejected(e) {
    return e && (e.code === "ACTION_REJECTED" || e.code === 4001 ||
      (e.info && e.info.error && e.info.error.code === 4001) ||
      /user (rejected|denied)/i.test(e.message || ""));
  }
  function errText(e) {
    if (isRejected(e)) return "Transaction cancelled in the wallet. No tokens were sent.";
    var m = (e && (e.shortMessage || e.reason || e.message)) || String(e);
    if (/insufficient funds/i.test(m)) return "Not enough SepoliaETH to pay for gas. Top up your wallet from a faucet.";
    return m.slice(0, 280);
  }

  // ---------- transaction log (this device only) ----------
  function loadLog() { try { return JSON.parse(localStorage.getItem("dih_dash_log") || "[]"); } catch (e) { return []; } }
  function saveLog(items) { try { localStorage.setItem("dih_dash_log", JSON.stringify(items.slice(0, 40))); } catch (e) {} }
  function addLog(item) { var l = loadLog(); l.unshift(item); saveLog(l); renderLog(); }
  function updateLog(hash, status) {
    var l = loadLog();
    l.forEach(function (it) { if (it.hash === hash) it.status = status; });
    saveLog(l); renderLog();
  }
  function renderLog() {
    var items = loadLog(), ul = $("log");
    if (!items.length) return;
    ul.innerHTML = "";
    items.forEach(function (it) {
      var li = document.createElement("li");
      var st = it.status === "ok" ? "<span class='st-ok'>confirmed</span>" :
               it.status === "fail" ? "<span class='st-err'>failed</span>" : "pending";
      li.innerHTML = "<span>" + esc(it.label) + " · " + st + "</span>" + txLink(it.hash, CONFIG.explorer.replace("https://", "") + "/tx/" + it.hash);
      ul.appendChild(li);
    });
  }

  // ---------- rendering ----------
  function renderTokens() {
    var box = $("tokens");
    box.innerHTML = "";
    tokens.forEach(function (t) {
      var d = document.createElement("article");
      d.className = "token";
      var bal = (t.balance != null && t.decimals != null) ? fmt(t.balance, t.decimals) : "—";
      var supply = (t.supply != null && t.decimals != null) ? fmt(t.supply, t.decimals) : "—";
      d.innerHTML =
        "<div class='top'><span class='sym'>" + esc(t.symbol || "…") + "</span><span class='tag'>" + esc(t.note) + "</span></div>" +
        "<div class='name'>" + esc(t.name || "Loading…") + "</div>" +
        "<div class='bal'>" + bal + "</div>" +
        "<div class='meta'>Total supply: " + supply + " · decimals: " + (t.decimals != null ? t.decimals : "—") + "</div>" +
        "<div class='addr'>" + esc(t.address) + "</div>" +
        (t.error ? "<div class='msg err'>" + esc(t.error) + "</div>" : "") +
        "<div class='actions'>" +
          "<a href='" + CONFIG.explorer + "/token/" + t.address + "' target='_blank' rel='noopener'>Etherscan ↗</a>" +
          (t.symbol ? "<button type='button' class='secondary small' data-watch='" + t.address + "'>Add to MetaMask</button>" : "") +
        "</div>";
      box.appendChild(d);
    });
    box.querySelectorAll("[data-watch]").forEach(function (b) {
      b.onclick = function () { watchToken(b.getAttribute("data-watch")); };
    });
    renderSelect();
  }

  function renderSelect() {
    var sel = $("tokenSel"), prev = sel.value;
    sel.innerHTML = "";
    tokens.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t.address;
      o.textContent = (t.symbol || short(t.address)) + (t.name ? " — " + t.name : "");
      sel.appendChild(o);
    });
    if (prev) sel.value = prev;
    renderAvail();
  }

  function selected() {
    var a = $("tokenSel").value;
    return tokens.filter(function (t) { return t.address === a; })[0] || tokens[0];
  }

  function renderAvail() {
    var t = selected();
    $("avail").textContent = (t && t.balance != null) ? fmt(t.balance, t.decimals) + " " + t.symbol : "—";
  }

  function updateSendButton() {
    $("sendBtn").disabled = busy || !account || !onSepolia;
    $("sendBtn").textContent = busy ? "Sending…" : "Send";
  }

  // ---------- chain / wallet ----------
  async function refreshAll() {
    if (!window.ethereum || !account) return;
    provider = new ethers.BrowserProvider(window.ethereum);   // fresh provider after any chain change
    var net = await provider.getNetwork();
    onSepolia = net.chainId === CONFIG.chainId;

    $("walletCard").hidden = false;
    $("acct").textContent = account;
    $("chain").textContent = onSepolia ? "Sepolia ✓" : "Wrong network (chain ID " + net.chainId + ")";
    $("switchBtn").hidden = onSepolia;
    $("testMainnetBtn").hidden = !(TEST_MODE && onSepolia);
    $("connectBtn").textContent = short(account);
    $("connectBtn").className = "secondary";
    updateSendButton();

    if (!onSepolia) {
      $("ethBal").textContent = "—";
      show("walletMsg", "err", "Your wallet is on a different network. Transfers are blocked until you switch to Ethereum Sepolia.");
      tokens.forEach(function (t) { t.balance = null; t.error = null; });
      renderTokens();
      return;
    }
    show("walletMsg", "", "");
    $("ethBal").textContent = fmt(await provider.getBalance(account), 18);
    await Promise.all(tokens.map(loadToken));
    renderTokens();
  }

  async function loadToken(t) {
    try {
      var c = new ethers.Contract(t.address, ERC20_ABI, provider);
      if (t.decimals == null) {
        var meta = await Promise.all([c.name(), c.symbol(), c.decimals()]);
        t.name = meta[0]; t.symbol = meta[1]; t.decimals = Number(meta[2]);
      }
      var vals = await Promise.all([c.balanceOf(account), c.totalSupply()]);
      t.balance = vals[0]; t.supply = vals[1]; t.error = null;
    } catch (e) {
      t.error = "Could not read the contract: " + errText(e);
    }
  }

  async function connect() {
    if (!window.ethereum) {
      show("walletMsg", "err", "No wallet found. Install MetaMask or open this page in the MetaMask in-app browser.");
      return;
    }
    try {
      var accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = ethers.getAddress(accs[0]);
      await refreshAll();
    } catch (e) {
      show("walletMsg", "err", isRejected(e) ? "Connection cancelled in the wallet." : errText(e));
    }
  }

  async function switchToSepolia() {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CONFIG.chainHex }] });
    } catch (e) {
      show("walletMsg", "err", "Could not switch network: " + errText(e));
    }
  }

  async function watchToken(address) {
    var t = tokens.filter(function (x) { return x.address === address; })[0];
    if (!t || !window.ethereum) return;
    try {
      await window.ethereum.request({ method: "wallet_watchAsset", params: { type: "ERC20", options: { address: t.address, symbol: t.symbol, decimals: t.decimals } } });
    } catch (e) { show("walletMsg", "err", errText(e)); }
  }

  // ---------- transfer ----------
  async function send(ev) {
    ev.preventDefault();
    if (busy) return;
    var t = selected();
    var to = $("toAddr").value.trim();
    var amountStr = $("amount").value.trim().replace(",", ".");

    // 1. validate everything BEFORE asking the wallet
    if (!account) { show("sendMsg", "err", "Connect your wallet first."); return; }
    if (!ethers.isAddress(to)) { show("sendMsg", "err", "Invalid recipient address. It must be 0x followed by 40 hexadecimal characters."); return; }
    if (to.toLowerCase() === ethers.ZeroAddress) { show("sendMsg", "err", "The zero address belongs to no one and the tokens would be burned. Enter another address."); return; }
    if (to.toLowerCase() === account.toLowerCase()) { show("sendMsg", "err", "That is your own address. Enter another participant's wallet."); return; }
    if (t.decimals == null || t.balance == null) { show("sendMsg", "err", "The token balance has not loaded yet. Reload the page."); return; }
    var amount;
    try { amount = ethers.parseUnits(amountStr, t.decimals); }
    catch (e) { show("sendMsg", "err", "Invalid amount. Enter a number such as 1 or 0.5 (at most " + t.decimals + " decimal places)."); return; }
    if (amount <= 0n) { show("sendMsg", "err", "Amount must be greater than zero."); return; }
    if (amount > t.balance) { show("sendMsg", "err", "Insufficient " + esc(t.symbol) + " balance: you have " + fmt(t.balance, t.decimals) + " but are trying to send " + fmt(amount, t.decimals) + "."); return; }

    // 2. re-check the network right before sending
    provider = new ethers.BrowserProvider(window.ethereum);
    var net = await provider.getNetwork();
    if (net.chainId !== CONFIG.chainId) {
      onSepolia = false; updateSendButton();
      show("sendMsg", "err", "Your wallet is not on Sepolia. The transfer is blocked: switch networks and try again.");
      return;
    }

    busy = true; updateSendButton();
    show("sendMsg", "info", "Confirm sending " + fmt(amount, t.decimals) + " " + esc(t.symbol) + " → " + short(to) + " in your wallet…");
    var hash = null;
    try {
      var signer = await provider.getSigner();
      var c = new ethers.Contract(t.address, ERC20_ABI, signer);
      var tx = await c.transfer(to, amount);
      hash = tx.hash;
      addLog({ label: fmt(amount, t.decimals) + " " + t.symbol + " → " + short(to), hash: hash, status: "pending" });
      show("sendMsg", "info", "Transaction sent, waiting for a block confirmation (usually 10–30 seconds). " + txLink(hash, "View ↗"));
      var receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error("Transaction failed (status 0).");
      updateLog(hash, "ok");
      show("sendMsg", "ok", "Done: " + fmt(amount, t.decimals) + " " + esc(t.symbol) + " sent to " + short(to) + ". " + txLink(hash));
      $("amount").value = "";
      await refreshAll();
    } catch (e) {
      if (hash) updateLog(hash, "fail");
      show("sendMsg", "err", errText(e) + (hash ? " " + txLink(hash) : ""));
    } finally {
      busy = false; updateSendButton();
    }
  }

  // ---------- wiring ----------
  $("connectBtn").onclick = connect;
  $("switchBtn").onclick = switchToSepolia;
  // Test helper for the "wrong chain" check: only visible with ?test=1 in the URL.
  var TEST_MODE = /[?&]test=1\b/.test(location.search);
  $("testMainnetBtn").onclick = async function () {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
    } catch (e) { show("walletMsg", "err", "Could not switch network: " + errText(e)); }
  };
  $("sendForm").addEventListener("submit", send);
  $("tokenSel").onchange = renderAvail;
  $("lecturerBtn").onclick = function () { $("toAddr").value = CONFIG.lecturer; };
  $("maxBtn").onclick = function () {
    var t = selected();
    if (t && t.balance != null) $("amount").value = ethers.formatUnits(t.balance, t.decimals).replace(/\.0$/, "");
  };

  if (window.ethereum && window.ethereum.on) {
    window.ethereum.on("accountsChanged", function (accs) {
      account = accs && accs[0] ? ethers.getAddress(accs[0]) : null;
      tokens.forEach(function (t) { t.balance = null; });
      if (account) refreshAll(); else location.reload();
    });
    window.ethereum.on("chainChanged", function () { if (account) refreshAll(); });
  }

  renderTokens();
  renderLog();
  updateSendButton();
  // reconnect silently if the site is already authorised in the wallet
  if (window.ethereum) {
    window.ethereum.request({ method: "eth_accounts" }).then(function (accs) {
      if (accs && accs[0]) { account = ethers.getAddress(accs[0]); refreshAll(); }
    }).catch(function () {});
  }
})();
