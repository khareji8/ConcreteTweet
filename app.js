document.addEventListener('DOMContentLoaded', () => {

    // ── Element references ──────────────────────────────────────────────────
    const scanBtn        = document.getElementById('scanBtn');
    const searchInput    = document.getElementById('searchInput');
    const resultCard     = document.getElementById('resultCardWrapper');
    const userAvatar     = document.getElementById('userAvatar');
    const userBadge      = document.getElementById('userBadge');
    const userNameEl     = document.getElementById('userName');
    const userHandleEl   = document.getElementById('userHandle');
    const userRoleEl     = document.getElementById('userRole');
    const mentionCountEl = document.getElementById('mentionCount');
    const viewsCountEl   = document.getElementById('viewsCount');
    const likesCountEl   = document.getElementById('likesCount');
    const retweetsCountEl= document.getElementById('retweetsCount');
    const repliesCountEl = document.getElementById('repliesCount');
    const firstDateEl    = document.getElementById('firstMentionDate');
    const lastDateEl     = document.getElementById('lastMentionDate');

    // ── Helpers ─────────────────────────────────────────────────────────────
    function fmt(num) {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1_000)     return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    }

    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return Math.abs(h);
    }

    // ── Generate colored initials avatar on local canvas (no network needed) ──
    function makeInitialsDataUrl(letter, size = 128) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const palette = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4'];
        ctx.fillStyle = palette[(letter || 'U').charCodeAt(0) % palette.length];
        ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(size*0.42)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((letter || 'U').toUpperCase(), size/2, size/2);
        return c.toDataURL();
    }

    // ── Known EVM → Twitter mapping (add more here) ─────────────────────────
    const addressMap = {
        '0x5761d5e9e2aae3340c9c6253d7c74f5e102f2528': 'pras_p69',
    };

    // ── Concrete official project account ────────────────────────────────────
    const concreteProject = new Set([
        'concretexyz',
    ]);

    // ── Concrete official team / affiliates ──────────────────────────────────
    const concreteTeam = new Set([
        'dill_sl',
        'gustavorssilva',
        'lukehajduk04',
        'andonpv',
        'crypttoji',
        'nic_builds',
        'concrete_intern',
    ]);

    // ── Role titles for team & project members ───────────────────────────────
    const roleMap = {
        'concretexyz':    'Official Project Account • @ConcreteXYZ',
        'dill_sl':        'Co-Founder • @Blueprint_DeFi & @ConcreteXYZ',
        'gustavorssilva': 'Engineering Manager • @Blueprint_DeFi & @ConcreteXYZ',
        'lukehajduk04':   'CGO • @Blueprint_DeFi & @ConcreteXYZ',
        'andonpv':        'Lead QA • @Blueprint_DeFi & @ConcreteXYZ',
        'crypttoji':      'Marketing • @ConcreteXYZ',
        'nic_builds':     'CEO • @ConcreteXYZ & @GlowFinanceXYZ',
        'concrete_intern':'Permanent Bullposter • @ConcreteXYZ',
    };

    // ── Scan Logic ──────────────────────────────────────────────────────────
    function doScan() {
        const raw = searchInput.value.trim();
        if (!raw) return;

        // Resolve identity
        let handle, displayName, isRawWallet = false;
        const lc = raw.toLowerCase();

        if (lc.startsWith('0x')) {
            const mapped = addressMap[lc];
            if (mapped) {
                handle = '@' + mapped;
            } else {
                isRawWallet = true;
                handle = raw;
            }
        } else if (lc.includes('concrete.xyz/')) {
            const slug = raw.split('/').pop().replace('@', '');
            handle = '@' + slug;
        } else {
            handle = raw.startsWith('@') ? raw : '@' + raw;
        }

        if (isRawWallet) {
            displayName = raw.length > 10
                ? raw.slice(0, 6) + '…' + raw.slice(-5)
                : raw;
        } else {
            const uname = handle.slice(1);
            if (uname.toLowerCase() === 'pras_p69') {
                displayName = 'Pras';
            } else {
                displayName = uname.charAt(0).toUpperCase() + uname.slice(1);
            }
        }

        // Button loading state
        scanBtn.textContent = 'Scanning…';
        scanBtn.disabled = true;
        resultCard.style.transform = 'scale(0.98)';
        resultCard.style.opacity = '0.7';

        setTimeout(() => {
            scanBtn.textContent = 'Scan';
            scanBtn.disabled = false;
            resultCard.style.transform = 'scale(1)';
            resultCard.style.opacity = '1';

            // Show "Open on X" button with correct profile link
            const openOnXBtn = document.getElementById('openOnXBtn');
            if (openOnXBtn) {
                const profileUrl = isRawWallet
                    ? `https://x.com/search?q=${encodeURIComponent(raw)}`
                    : `https://x.com/${handle.slice(1)}`;
                openOnXBtn.href = profileUrl;
                openOnXBtn.style.display = 'inline-flex';
            }

            // Avatar — normal live load (no crossOrigin), separate wsrv.nl cache for export
            const avatarSlug = isRawWallet ? null : handle.slice(1);
            window._cachedAvatarDataUrl = null;
            window._avatarCachePromise = null;

            if (!isRawWallet) {
                // Live display: no crossOrigin, unavatar.io works perfectly for display
                userAvatar.removeAttribute('crossorigin');
                userAvatar.src = `https://unavatar.io/twitter/${avatarSlug}`;

                // Export cache: wsrv.nl serves directly with CORS headers
                // URL must NOT include https:// prefix per wsrv.nl docs
                const wsrvUrl = `https://wsrv.nl/?url=unavatar.io/twitter/${avatarSlug}&w=256&h=256&fit=cover&output=jpg`;
                window._avatarCachePromise = new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        try {
                            const cv = document.createElement('canvas');
                            cv.width = cv.height = 256;
                            cv.getContext('2d').drawImage(img, 0, 0, 256, 256);
                            window._cachedAvatarDataUrl = cv.toDataURL();
                        } catch {
                            window._cachedAvatarDataUrl = makeInitialsDataUrl(displayName[0] || 'U');
                        }
                        resolve();
                    };
                    img.onerror = () => {
                        window._cachedAvatarDataUrl = makeInitialsDataUrl(displayName[0] || 'U');
                        resolve();
                    };
                    img.src = wsrvUrl;
                });
            } else {
                const fallback = makeInitialsDataUrl(displayName[0] || 'W');
                userAvatar.removeAttribute('crossorigin');
                userAvatar.src = fallback;
                window._cachedAvatarDataUrl = fallback;
                window._avatarCachePromise = Promise.resolve();
            }

            // Badge — PROJECT / TEAM / WALLET / MEMBER
            if (userBadge) {
                const uhandle = handle.slice(1).toLowerCase();
                if (isRawWallet) {
                    userBadge.textContent = 'WALLET';
                    userBadge.style.background = 'linear-gradient(135deg, #374151, #6b7280)';
                } else if (concreteProject.has(uhandle)) {
                    userBadge.textContent = 'PROJECT';
                    userBadge.style.background = 'linear-gradient(135deg, #7c3aed, #a855f7)';
                } else if (concreteTeam.has(uhandle)) {
                    userBadge.textContent = 'TEAM';
                    userBadge.style.background = '';
                } else {
                    userBadge.textContent = 'MEMBER';
                    userBadge.style.background = 'linear-gradient(135deg, #1d4ed8, #3b82f6)';
                }
            }

            // Name / handle / role
            userNameEl.innerHTML = `${displayName} <span class="verified"></span>`;
            userHandleEl.textContent = handle;
            // Show role for known team/project members, hide for others
            if (userRoleEl) {
                const uhandle = handle.slice(1).toLowerCase();
                const role = roleMap[uhandle];
                if (role) {
                    userRoleEl.textContent = role;
                    userRoleEl.style.display = 'block';
                } else {
                    userRoleEl.textContent = '';
                    userRoleEl.style.display = 'none';
                }
            }

            // Stats
            const h = hash(handle.toLowerCase());
            let views, mentions;
            const cleanHandle = handle.slice(1).toLowerCase();

            // Override for team members so they match the leaderboard
            if (cleanHandle === 'concretexyz') { views = 431000000; mentions = 44; }
            else if (cleanHandle === 'dill_sl') { views = 61000000; mentions = 855; }
            else if (cleanHandle === 'gustavorssilva') { views = 52000000; mentions = 564; }
            else if (cleanHandle === 'lukehajduk04') { views = 18000000; mentions = 918; }
            else if (cleanHandle === 'andonpv') { views = 17000000; mentions = 280; }
            else if (cleanHandle === 'nic_builds') { views = 15000000; mentions = 1373; }
            else {
                // Regular users get very modest, realistic stats
                const isViral = (h % 100) > 95; // 5% chance of slightly viral account
                const maxViews = isViral ? 2_500_000 : 450_000;
                
                const viewsRaw = (h * 137) % maxViews;
                views = viewsRaw + 1500; // minimum 1.5k views
                
                const mentionsBase = Math.max(2, Math.floor(views / ((h % 50000) + 15000)));
                mentions = Math.min(300, mentionsBase + (h % 50) + 3);
            }

            // Likes: Realistic Twitter engagement is ~0.5% to ~3% of views
            const likeRate = 0.005 + ((h % 25) / 1000); 
            const likes = Math.floor(views * likeRate) + (h % 500);

            // Retweets: Usually 10% to 25% of likes
            const rtRate = 0.1 + ((h % 15) / 100); 
            const retweets = Math.floor(likes * rtRate) + (h % 100);

            // Replies: Usually 5% to 15% of likes
            const replyRate = 0.05 + ((h % 10) / 100);
            const replies = Math.floor(likes * replyRate) + (h % 50);

            mentionCountEl.textContent  = mentions.toLocaleString();
            viewsCountEl.textContent    = fmt(views);
            likesCountEl.textContent    = fmt(likes);
            retweetsCountEl.textContent = fmt(retweets);
            repliesCountEl.textContent  = fmt(replies);

            // Dates Logic (Strictly between Dec 2023 and Today)
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const todayMs = new Date().getTime();
            const startMs = new Date('2023-12-01T00:00:00Z').getTime();
            
            // Ensure first date is between Dec 2023 and 30 days ago
            let firstTimeMs = startMs + (h % Math.max(86400000, todayMs - startMs - 2592000000));
            
            // Ensure last mention is very recent (within the last 14 days from today)
            const maxDaysAgoMs = 14 * 24 * 60 * 60 * 1000;
            let lastTimeMs = todayMs - (h % maxDaysAgoMs);
            
            // Sanity check: Last mention cannot be before first mention
            if (lastTimeMs <= firstTimeMs) {
                lastTimeMs = todayMs; 
            }

            const fd = new Date(firstTimeMs);
            const ld = new Date(lastTimeMs);

            if (firstDateEl) firstDateEl.textContent = `${months[fd.getMonth()]} ${fd.getDate()}, ${fd.getFullYear()}`;
            if (lastDateEl)  lastDateEl.textContent  = `${months[ld.getMonth()]} ${ld.getDate()}, ${ld.getFullYear()}`;

            // ── Tweet Showcase Logic ────────────────────────────────────────────────
            const tweetShowcase = document.getElementById('tweetShowcase');
            const tweetsContainer = document.getElementById('tweetsContainer');
            if (tweetShowcase && tweetsContainer) {
                tweetShowcase.style.display = 'block';

                const mockTexts = [
                    "Every defi user should try Concrete ASAP.",
                    "Concrete's first scalar market is live.",
                    "Still an iterative process product-wise, and always open to feedback (DM me). We'll be able to support markets that have never before been possible. So excited for Concrete.",
                    "Concrete is going to change the way we look at on-chain yield.",
                    "Been digging into the Concrete docs. The architecture is incredibly solid.",
                    "Just provided some liquidity on Concrete. The UX is buttery smooth.",
                    "Big things coming for ConcreteXYZ.",
                    "If you aren't paying attention to Concrete, you're fading the next big primitive.",
                    "Concrete testnet was good, but mainnet is flawless.",
                    "The team at Concrete is shipping at lightspeed."
                ];

                // Separate text pools so First & Top 5 never overlap
                const firstTexts = [
                    "Just heard about Concrete for the first time. Sounds interesting 👀",
                    "Early on $Concrete. The architecture is unlike anything I've seen in DeFi.",
                    "Heard a lot about ConcreteXYZ lately. Decided to dig in.",
                    "Been exploring yield strategies and Concrete keeps coming up. LFG.",
                    "First time tweeting about Concrete. Won't be the last. 🏗️",
                    "This might be one of the most underrated DeFi protocols out there. GM Concrete.",
                    "Can't stop thinking about the ConcreteXYZ thesis. Writing a thread soon.",
                    "Quietly accumulating Concrete. The fundamentals are solid.",
                ];

                const topTexts = [
                    "If you're not watching ConcreteXYZ you're seriously missing out. Thread below 🧵",
                    "Concrete just keeps shipping. One of the few teams I fully trust in this space.",
                    "The liquidity engine Concrete built is genuinely impressive. Bullish.",
                    "Everyone talks about DeFi innovation. Concrete actually delivers it.",
                    "Just exited a position on Concrete with 2x. The yield mechanics are wild.",
                    "ConcreteXYZ is the kind of protocol that makes you feel early. In 2026.",
                    "Concrete's roadmap is making me re-allocate my entire portfolio.",
                    "The numbers don't lie. Concrete TVL is going parabolic. 📈",
                ];

                function generateMockTweets(isTop) {
                    let html = '';

                    // Date boundaries
                    const now = new Date();
                    const concreteStart = new Date('2023-12-01T00:00:00Z').getTime();

                    for (let i = 0; i < 5; i++) {
                        // Use different seeds for first vs top so texts never overlap
                        const seed = Math.abs(h * 7 + i * 31 + (isTop ? 9999 : 1111));
                        const txt = isTop
                            ? topTexts[seed % topTexts.length]
                            : firstTexts[seed % firstTexts.length];

                        // Date Logic
                        let tMs;
                        if (isTop) {
                            // Top 5: very recent — between 2 and 14 days ago
                            const minAgo = 2  * 24 * 60 * 60 * 1000;
                            const maxAgo = 14 * 24 * 60 * 60 * 1000;
                            tMs = now.getTime() - minAgo - (seed % (maxAgo - minAgo));
                        } else {
                            // First 5: from Dec 2023 onward, spread across early period
                            const earlyWindow = 120 * 24 * 60 * 60 * 1000; // first 120 days after Dec 2023
                            tMs = concreteStart + (seed % earlyWindow);
                        }

                        const d = new Date(tMs);
                        const dStr = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                        const timeStr = `${1 + (seed % 12)}:${(seed % 60).toString().padStart(2, '0')} ${seed % 2 === 0 ? 'AM' : 'PM'}`;

                        // Stats
                        let tViews, tLikes;
                        if (isTop) {
                            tViews = Math.floor(views * (0.08 + ((seed % 15) / 100)));
                            tLikes = Math.floor(tViews * 0.025);
                        } else {
                            tViews = Math.floor(views * (0.002 + ((seed % 8) / 1000)));
                            tLikes = Math.floor(tViews * 0.01);
                        }
                        tViews = Math.max(tViews, 80);
                        tLikes = Math.max(tLikes, 2);
                        const tRts  = Math.floor(tLikes * 0.2);
                        const tReps = Math.floor(tLikes * 0.1);

                        // Always use the live avatar src for display in tweet cards
                        // (no CORS issue here — these cards don't need canvas export)
                        const avatarSrc = userAvatar.src || '';

                        html += `
                        <div style="background: #000; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            ${isTop && i === 0 ? `<div style="color: var(--accent-blue); font-size: 0.75rem; font-weight: 800; margin-bottom: 12px; letter-spacing: 0.5px;">⭐ TOP PERFORMING TWEET</div>` : ''}
                            ${!isTop && i === 0 ? `<div style="color: var(--accent-blue); font-size: 0.75rem; font-weight: 800; margin-bottom: 12px; letter-spacing: 0.5px; background: rgba(59,130,246,0.15); display: inline-block; padding: 4px 8px; border-radius: 4px;">FIRST CONCRETE TWEET</div>` : ''}
                            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                                <img src="${avatarSrc}" style="width: 48px; height: 48px; border-radius: 50%; margin-right: 12px;" alt="User">
                                <div>
                                    <div style="font-weight: 700; display: flex; align-items: center; gap: 4px; font-size: 1.05rem;">${displayName} <span class="verified"></span></div>
                                    <div style="color: #71767b; font-size: 0.95rem;">${handle}</div>
                                </div>
                            </div>
                            <div style="font-size: 1.05rem; line-height: 1.5; margin-bottom: 15px; font-weight: 400;">${txt}</div>
                            <div style="color: #71767b; font-size: 0.95rem; margin-bottom: 15px;">${timeStr} · ${dStr}</div>
                            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; display: flex; gap: 20px; color: #71767b; font-size: 0.95rem; font-weight: 500;">
                                <span>💬 ${fmt(tReps)}</span>
                                <span>🔁 ${fmt(tRts)}</span>
                                <span>❤️ ${fmt(tLikes)}</span>
                                <span>📊 ${fmt(tViews)}</span>
                                <span style="margin-left: auto; font-size: 0.8rem; opacity: 0.4; font-weight: 400;">concretetweet.com</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
                                <button style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; font-weight: 600;"><span class="icon-copy" style="font-size: 1rem;">⎘</span> Share</button>
                                <a href="https://x.com/${handle.slice(1)}" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-size: 0.9rem; font-weight: 500;">Open on X →</a>
                            </div>
                        </div>
                        `;
                    }
                    tweetsContainer.innerHTML = html;
                }

                // Initial render
                generateMockTweets(false);

                // Once the avatar cache resolves, update all tweet card avatars
                // so the scanned user's actual profile picture always shows up
                if (window._avatarCachePromise) {
                    window._avatarCachePromise.then(() => {
                        const finalSrc = window._cachedAvatarDataUrl || userAvatar.src;
                        tweetsContainer.querySelectorAll('img').forEach(img => {
                            img.src = finalSrc;
                        });
                    });
                }

                // Setup toggles
                const firstBtn = document.getElementById('firstTweetsBtn');
                const topBtn = document.getElementById('topTweetsBtn');
                
                // Clear old listeners by cloning
                const newFirst = firstBtn.cloneNode(true);
                const newTop = topBtn.cloneNode(true);
                firstBtn.parentNode.replaceChild(newFirst, firstBtn);
                topBtn.parentNode.replaceChild(newTop, topBtn);

                newFirst.addEventListener('click', () => {
                    newFirst.classList.add('active');
                    newFirst.style.background = 'var(--accent-blue)';
                    newFirst.style.color = 'white';
                    newTop.classList.remove('active');
                    newTop.style.background = 'transparent';
                    newTop.style.color = 'var(--text-secondary)';
                    generateMockTweets(false);
                });

                newTop.addEventListener('click', () => {
                    newTop.classList.add('active');
                    newTop.style.background = 'var(--accent-blue)';
                    newTop.style.color = 'white';
                    newFirst.classList.remove('active');
                    newFirst.style.background = 'transparent';
                    newFirst.style.color = 'var(--text-secondary)';
                    generateMockTweets(true);
                });
            }

        }, 800);
    }

    if (scanBtn)     scanBtn.addEventListener('click', doScan);
    if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') doScan(); });


    // ── Share Modal ─────────────────────────────────────────────────────────
    const shareBtn        = document.getElementById('shareBtn');
    const shareModal      = document.getElementById('shareModal');
    const closeModalBtn   = document.getElementById('closeModalBtn');
    const cancelModalBtn  = document.getElementById('cancelModalBtn');
    const copyImageBtn    = document.getElementById('copyImageBtn');
    const modalCapture    = document.getElementById('modalCaptureArea');

    // ── Draw Concrete logo on canvas (avoids SVG rendering bugs in html2canvas)
    function makeConcreteLogoDataUrl(size = 64) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const r = size * 0.125;
        // Rounded yellow background
        ctx.beginPath();
        ctx.moveTo(r, 0); ctx.lineTo(size - r, 0);
        ctx.quadraticCurveTo(size, 0, size, r);
        ctx.lineTo(size, size - r);
        ctx.quadraticCurveTo(size, size, size - r, size);
        ctx.lineTo(r, size);
        ctx.quadraticCurveTo(0, size, 0, size - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fillStyle = '#F2E27A';
        ctx.fill();
        ctx.fillStyle = '#111111';
        // Top bar
        ctx.fillRect(size * 0.22, size * 0.16, size * 0.56, size * 0.07);
        // C letter
        ctx.font = `bold ${Math.round(size * 0.54)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('C', size / 2, size * 0.52);
        // Bottom bar
        ctx.fillRect(size * 0.22, size * 0.77, size * 0.56, size * 0.07);
        return c.toDataURL();
    }

    // ── Colored initials avatar (local canvas, zero network) ─────────────────
    function makeInitialsDataUrl(letter, size = 128) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const palette = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#06b6d4'];
        ctx.fillStyle = palette[letter.charCodeAt(0) % palette.length];
        ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(size*0.42)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter.toUpperCase(), size/2, size/2);
        return c.toDataURL();
    }

    // ── Load image via weserv.nl CORS proxy → canvas data URL ─────────────────
    function imgElementToDataUrl(imgEl) {
        return new Promise(resolve => {
            const letter = (imgEl.alt || imgEl.src || 'U').replace(/[^a-zA-Z]/g, '')[0] || 'U';
            const fallback = makeInitialsDataUrl(letter);
            if (!imgEl.src || imgEl.src.startsWith('data:')) return resolve(imgEl.src || fallback);

            // Use weserv.nl as a CORS-enabled image proxy
            const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imgEl.src)}&w=256&h=256&fit=cover`;
            const tmp = new Image();
            tmp.crossOrigin = 'anonymous';
            tmp.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width  = tmp.naturalWidth  || 128;
                    c.height = tmp.naturalHeight || 128;
                    c.getContext('2d').drawImage(tmp, 0, 0);
                    resolve(c.toDataURL());
                } catch { resolve(fallback); }
            };
            tmp.onerror = () => resolve(fallback);
            tmp.src = proxyUrl;
        });
    }

    async function openModal() {
        if (!shareModal || !modalCapture) return;
        modalCapture.innerHTML = '';
        const card = document.getElementById('resultCardWrapper');
        if (!card) return;

        // Wait for avatar caching to complete before building modal
        if (window._avatarCachePromise) {
            await window._avatarCachePromise;
        }

        const clone = card.cloneNode(true);
        clone.style.margin = '0';
        clone.style.width  = '100%';
        modalCapture.appendChild(clone);

        // Replace all images with data URIs to avoid tainted canvas
        const imgs = [...clone.querySelectorAll('img')];
        await Promise.all(imgs.map(async img => {
            if (img.src.includes('concrete-logo')) {
                // Draw Concrete logo on canvas — html2canvas can't render SVG text
                img.src = makeConcreteLogoDataUrl(64);
            } else if (img.src.includes('unavatar.io') && window._cachedAvatarDataUrl) {
                // Use pre-cached avatar (loaded via weserv.nl CORS proxy)
                img.src = window._cachedAvatarDataUrl;
            } else if (window._cachedAvatarDataUrl && img.id === 'userAvatar') {
                img.src = window._cachedAvatarDataUrl;
            } else {
                img.src = await imgElementToDataUrl(img);
            }
        }));

        shareModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (shareModal) shareModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    if (shareBtn)       shareBtn.addEventListener('click', () => openModal());
    if (closeModalBtn)  closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    // Close on backdrop click
    if (shareModal) {
        shareModal.addEventListener('click', e => {
            if (e.target === shareModal) closeModal();
        });
    }

    // ── Aspect toggle ───────────────────────────────────────────────────────
    const aspectBtns = document.querySelectorAll('.aspect-btn');
    aspectBtns.forEach(btn => {
        btn.addEventListener('click', e => {
            aspectBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            if (e.currentTarget.textContent.includes('Portrait')) {
                modalCapture.classList.add('portrait-mode');
            } else {
                modalCapture.classList.remove('portrait-mode');
            }
        });
    });

    // ── Copy to clipboard ───────────────────────────────────────────────────
    if (copyImageBtn) {
        copyImageBtn.addEventListener('click', async () => {
            const target = modalCapture.querySelector('.card-glow-wrapper');
            if (!target) { alert('Card not found in preview.'); return; }

            const orig = copyImageBtn.textContent;
            copyImageBtn.textContent = 'Generating…';
            copyImageBtn.disabled = true;

            try {
                if (typeof html2canvas === 'undefined') throw new Error('html2canvas not loaded');

                const canvas = await html2canvas(target, {
                    backgroundColor: '#050505',
                    useCORS: true,
                    scale: 2,
                    logging: false
                });

                // Try modern clipboard API first
                try {
                    canvas.toBlob(async blob => {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        copyImageBtn.textContent = '✓ Copied!';
                        copyImageBtn.style.background = '#10b981';
                        setTimeout(() => {
                            copyImageBtn.textContent = orig;
                            copyImageBtn.style.background = '';
                            copyImageBtn.disabled = false;
                        }, 2500);
                    }, 'image/png');
                } catch {
                    // Fallback: download the image
                    const link = document.createElement('a');
                    link.download = 'concrete-tweet-card.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    copyImageBtn.textContent = '✓ Downloaded!';
                    copyImageBtn.style.background = '#10b981';
                    setTimeout(() => {
                        copyImageBtn.textContent = orig;
                        copyImageBtn.style.background = '';
                        copyImageBtn.disabled = false;
                    }, 2500);
                }
            } catch (err) {
                console.error(err);
                alert('Image generation failed: ' + err.message);
                copyImageBtn.textContent = orig;
                copyImageBtn.disabled = false;
            }
        });
    }

});
