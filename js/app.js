const App = {
    location:    null,
    restaurants: [],
    excluded:    new Set(),
    radius:      1000,
    category:    'FD6',
    slot:        null,
    currentResult: null,

    async init() {
        this.slot = new SlotMachine(
            document.getElementById('reel'),
            (r) => this.showResult(r)
        );
        this._bindEvents();
        await this._getLocation();
    },

    _bindEvents() {
        document.getElementById('spin-btn').addEventListener('click', () => this._spin());
        document.getElementById('refresh-location').addEventListener('click', () => this._getLocation());

        document.querySelectorAll('.radius-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.radius = parseInt(btn.dataset.radius);
                this._fetchRestaurants();
            });
        });

        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.category = btn.dataset.cat;
                this._fetchRestaurants();
            });
        });

        document.getElementById('modal-close').addEventListener('click',  () => this._closeModal());
        document.getElementById('modal-overlay').addEventListener('click', () => this._closeModal());

        document.getElementById('retry-btn').addEventListener('click', () => {
            this._closeModal();
            setTimeout(() => this._spin(), 320);
        });

        document.getElementById('exclude-btn').addEventListener('click', () => {
            if (this.currentResult) {
                this.excluded.add(this.currentResult.id);
                this._applyFilter();
            }
            this._closeModal();
        });

        document.getElementById('navi-btn').addEventListener('click', () => {
            if (this.currentResult) {
                KakaoMapService.navigateTo(
                    parseFloat(this.currentResult.y),
                    parseFloat(this.currentResult.x),
                    this.currentResult.place_name
                );
            }
        });

        document.getElementById('location-retry').addEventListener('click', () => {
            document.getElementById('location-modal').classList.add('hidden');
            this._getLocation();
        });
    },

    async _getLocation() {
        const txt = document.getElementById('location-text');
        txt.textContent = '위치를 불러오는 중...';
        try {
            this.location = await LocationService.getCurrentPosition();
        } catch (e) {
            txt.textContent = '위치를 가져올 수 없어요';
            document.getElementById('location-modal').classList.remove('hidden');
            return;
        }
        try {
            const addr  = await LocationService.getAddressFromCoords(this.location.lat, this.location.lng);
            txt.textContent = addr;
        } catch (e) {
            txt.textContent = '위치 확인됨';
        }
        await this._fetchRestaurants();
    },

    async _fetchRestaurants() {
        if (!this.location) return;

        const countEl  = document.getElementById('result-count');
        const spinBtn  = document.getElementById('spin-btn');
        countEl.textContent = '🔍 주변 맛집 검색 중...';
        spinBtn.disabled    = true;

        try {
            const params = new URLSearchParams({
                x:        this.location.lng,
                y:        this.location.lat,
                radius:   this.radius,
                category: this.category
            });
            const res  = await fetch(`/api/restaurants?${params}`);
            const data = await res.json();

            if (data.error) {
                console.error('API 오류:', data.error, data.status);
                countEl.textContent = `⚠️ API 오류 (${data.status || res.status}) — Cloudflare 환경변수를 확인해주세요`;
                spinBtn.disabled = true;
                return;
            }

            this.restaurants = data.documents || [];
            this._applyFilter();
        } catch (e) {
            console.error('fetch 오류:', e);
            countEl.textContent = '⚠️ 맛집을 불러오지 못했어요 (네트워크 오류)';
            spinBtn.disabled = false;
        }
    },

    _applyFilter() {
        const countEl = document.getElementById('result-count');
        const spinBtn = document.getElementById('spin-btn');
        const list    = this.restaurants.filter(r => !this.excluded.has(r.id));

        this.slot.setRestaurants(list);

        if (list.length > 0) {
            countEl.textContent = `✧ 주변 맛집 ${list.length}곳 발견!`;
            spinBtn.disabled    = false;
        } else {
            countEl.textContent = '😢 맛집이 없어요. 반경을 늘려보세요!';
            spinBtn.disabled    = true;
        }
    },

    _spin() {
        const spinBtn = document.getElementById('spin-btn');
        spinBtn.disabled = true;
        spinBtn.classList.add('spinning');

        this.slot.spin();

        setTimeout(() => {
            spinBtn.disabled = false;
            spinBtn.classList.remove('spinning');
        }, 3900);
    },

    showResult(restaurant) {
        this.currentResult = restaurant;

        document.getElementById('res-name').textContent     = restaurant.place_name;
        document.getElementById('res-category').textContent = `${getCategoryEmoji(restaurant.category_name)} ${restaurant.category_name || '음식점'}`;
        document.getElementById('res-address').textContent  = restaurant.road_address_name || restaurant.address_name || '-';
        document.getElementById('res-distance').textContent = restaurant.distance ? `약 ${restaurant.distance}m` : '-';
        document.getElementById('res-phone').textContent    = restaurant.phone || '정보 없음';

        const leafCat = (restaurant.category_name || '').split('>').pop().trim();
        const chipEl  = document.getElementById('res-cat-chip');
        if (chipEl) chipEl.textContent = leafCat;

        ['res-open-row','res-rating-row','res-homepage-row','res-parking-row','res-menu-row']
            .forEach(id => document.getElementById(id).classList.add('hidden'));

        document.getElementById('result-modal').classList.remove('hidden');

        const placeId = restaurant.id || (restaurant.place_url || '').split('/').pop();
        this._fetchPlaceDetail(placeId);

        setTimeout(() => {
            KakaoMapService.initMiniMap(
                'mini-map',
                parseFloat(restaurant.y),
                parseFloat(restaurant.x),
                restaurant
            );
        }, 350);

        this._launchConfetti();
    },

    async _fetchPlaceDetail(id) {
        try {
            console.log('[place] fetching id:', id);
            const res  = await fetch(`/api/place?id=${id}`);
            const data = await res.json();
            console.log('[place] response:', data);
            if (data.error) { console.warn('[place] API error:', data.error); return; }

            // 영업 상태 + 시간
            if (data.isOpen !== null) {
                let statusHtml = '';
                if (data.isHoliday) {
                    statusHtml = '<span class="closed-badge">휴무일</span>';
                } else if (data.isBreak) {
                    statusHtml = '<span class="break-badge">브레이크타임</span>';
                } else if (data.isOpen) {
                    statusHtml = '<span class="open-badge">영업중</span>';
                } else {
                    statusHtml = '<span class="closed-badge">영업종료</span>';
                }
                document.getElementById('res-open-status').innerHTML = statusHtml;
                if (data.hours) {
                    document.getElementById('res-hours').textContent = data.hours;
                }
                document.getElementById('res-open-row').classList.remove('hidden');
            }

            // 별점
            if (data.rating) {
                const stars = this._renderStars(parseFloat(data.rating));
                document.getElementById('res-rating').innerHTML =
                    `${stars} ${data.rating}`
                    + (data.reviewcnt ? ` <span style="opacity:0.55;font-size:11px;">(리뷰 ${data.reviewcnt})</span>` : '');
                document.getElementById('res-rating-row').classList.remove('hidden');
            }

            // 홈페이지
            if (data.homepage) {
                document.getElementById('res-homepage').href = data.homepage;
                document.getElementById('res-homepage-row').classList.remove('hidden');
            }

            // 주차
            if (data.parking) {
                document.getElementById('res-parking').textContent = data.parking;
                document.getElementById('res-parking-row').classList.remove('hidden');
            }

            // 메뉴
            if (data.menus && data.menus.length > 0) {
                document.getElementById('res-menus').innerHTML = data.menus.map(m =>
                    `<div class="menu-item">
                        <span class="menu-item-name">${m.name}</span>
                        ${m.price ? `<span class="menu-item-price">${m.price}</span>` : ''}
                    </div>`
                ).join('');
                document.getElementById('res-menu-row').classList.remove('hidden');
            }
        } catch (e) {
            console.error('[place] 상세 정보 오류:', e);
        }
    },

    _renderStars(score) {
        const full  = Math.floor(score);
        const half  = score - full >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return '<span style="color:#c9a96e;letter-spacing:1px;">'
            + '★'.repeat(full)
            + (half ? '½' : '')
            + '<span style="opacity:0.3;">' + '★'.repeat(empty) + '</span>'
            + '</span>';
    },

    _closeModal() {
        document.getElementById('result-modal').classList.add('hidden');
    },

    _launchConfetti() {
        const container = document.getElementById('confetti-container');
        container.innerHTML = '';
        const colors = ['#c9a96e', '#d4b483', '#f0d060', '#e8c87a', '#fff3d0', '#b8942e', '#f5dfa0'];

        for (let i = 0; i < 60; i++) {
            const el = document.createElement('div');
            el.className = 'confetti-piece';
            const size = 6 + Math.random() * 9;
            el.style.cssText = `
                left: ${Math.random() * 100}%;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                width: ${size}px;
                height: ${size}px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                animation-delay: ${Math.random() * 0.6}s;
                animation-duration: ${1.4 + Math.random() * 1.6}s;
            `;
            container.appendChild(el);
        }
        setTimeout(() => { container.innerHTML = ''; }, 3200);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
