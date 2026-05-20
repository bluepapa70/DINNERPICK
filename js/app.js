const App = {
    location:         null,
    allRestaurants:   [],
    excluded:         new Set(),
    radius:           1000,
    category:         'FD6',
    comboMode:        false,
    foodPlaces:       [],
    barPlaces:        [],
    slot:             null,
    currentResult:    null,
    currentBarResult: null,

    async init() {
        this.slot = new SlotMachine(
            document.getElementById('reel'),
            (r) => {
                if (this.comboMode) this.showComboResult(r);
                else this.showResult(r);
            }
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
                this._applyFilter();
            });
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.comboMode = btn.dataset.mode === 'combo';
                this._applyFilter();
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

        document.getElementById('combo-modal-close').addEventListener('click',  () => this._closeComboModal());
        document.getElementById('combo-modal-overlay').addEventListener('click', () => this._closeComboModal());

        document.getElementById('combo-retry-btn').addEventListener('click', () => {
            this._closeComboModal();
            setTimeout(() => this._spin(), 320);
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
                category: 'FD6'
            });
            const res  = await fetch(`/api/restaurants?${params}`);
            const data = await res.json();

            if (data.error) {
                countEl.textContent = `⚠️ API 오류 (${data.status || res.status}) — Cloudflare 환경변수를 확인해주세요`;
                spinBtn.disabled = true;
                return;
            }

            this.allRestaurants = data.documents || [];
            this._applyFilter();
        } catch (e) {
            countEl.textContent = '⚠️ 맛집을 불러오지 못했어요 (네트워크 오류)';
            spinBtn.disabled = false;
        }
    },

    _isBar(r) {
        const cat = r.category_name || '';
        return cat.includes('술집') || cat.includes('주점') || cat.includes('호프');
    },

    _applyFilter() {
        const countEl = document.getElementById('result-count');
        const spinBtn = document.getElementById('spin-btn');

        const nonExcluded = this.allRestaurants.filter(r => !this.excluded.has(r.id));

        let food = nonExcluded.filter(r => !this._isBar(r));
        if (this.category !== 'FD6') {
            food = food.filter(r => r.category_name && r.category_name.includes(this.category));
        }
        this.foodPlaces = food;
        this.barPlaces  = nonExcluded.filter(r => this._isBar(r));

        this.slot.setRestaurants(this.foodPlaces);

        if (this.foodPlaces.length > 0) {
            if (this.comboMode && this.barPlaces.length > 0) {
                countEl.textContent = `✧ 음식점 ${this.foodPlaces.length}곳 · 술집 ${this.barPlaces.length}곳 발견!`;
            } else if (this.comboMode) {
                countEl.textContent = `✧ 음식점 ${this.foodPlaces.length}곳 발견 (근처 술집 없음)`;
            } else {
                countEl.textContent = `✧ 주변 맛집 ${this.foodPlaces.length}곳 발견!`;
            }
            spinBtn.disabled = false;
        } else {
            countEl.textContent = '😢 맛집이 없어요. 반경을 늘려보세요!';
            spinBtn.disabled = true;
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

        document.getElementById('res-name').textContent    = restaurant.place_name;
        document.getElementById('res-category').textContent = `${getCategoryEmoji(restaurant.category_name)} ${restaurant.category_name || '음식점'}`;
        document.getElementById('res-address').textContent  = restaurant.road_address_name || restaurant.address_name || '-';

        const leafCat = (restaurant.category_name || '').split('>').pop().trim();
        const chipEl  = document.getElementById('res-cat-chip');
        if (chipEl) chipEl.textContent = leafCat;

        if (restaurant.distance) {
            const dist = parseInt(restaurant.distance);
            const mins = Math.max(1, Math.round(dist / 67));
            document.getElementById('res-distance').textContent = `${dist.toLocaleString()}m`;
            document.getElementById('res-walk').textContent     = `도보 약 ${mins}분`;
        } else {
            document.getElementById('res-distance').textContent = '-';
            document.getElementById('res-walk').textContent     = '-';
        }

        if (restaurant.place_url) {
            document.getElementById('res-kakaomap').href = restaurant.place_url;
            document.getElementById('res-kakaomap-row').classList.remove('hidden');
        } else {
            document.getElementById('res-kakaomap-row').classList.add('hidden');
        }

        document.getElementById('result-modal').classList.remove('hidden');

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

    showComboResult(foodRestaurant) {
        this.currentResult = foodRestaurant;

        const bar = this.barPlaces.length > 0
            ? this.barPlaces[Math.floor(Math.random() * this.barPlaces.length)]
            : null;
        this.currentBarResult = bar;

        this._fillComboCard('food', foodRestaurant);

        if (bar) {
            this._fillComboCard('bar', bar);
            document.getElementById('combo-bar-card').classList.remove('hidden');
            document.getElementById('combo-no-bar').classList.add('hidden');
        } else {
            document.getElementById('combo-bar-card').classList.add('hidden');
            document.getElementById('combo-no-bar').classList.remove('hidden');
        }

        document.getElementById('combo-modal').classList.remove('hidden');
        this._launchConfetti();
    },

    _fillComboCard(type, r) {
        const p = `combo-${type}`;
        document.getElementById(`${p}-name`).textContent     = r.place_name;
        document.getElementById(`${p}-category`).textContent = `${getCategoryEmoji(r.category_name)} ${r.category_name || '음식점'}`;
        document.getElementById(`${p}-address`).textContent  = r.road_address_name || r.address_name || '-';

        if (r.distance) {
            const dist = parseInt(r.distance);
            const mins = Math.max(1, Math.round(dist / 67));
            document.getElementById(`${p}-distance`).textContent = `${dist.toLocaleString()}m · 도보 약 ${mins}분`;
        } else {
            document.getElementById(`${p}-distance`).textContent = '-';
        }

        if (r.place_url) {
            document.getElementById(`${p}-kakaomap`).href = r.place_url;
            document.getElementById(`${p}-kakaomap-row`).classList.remove('hidden');
        } else {
            document.getElementById(`${p}-kakaomap-row`).classList.add('hidden');
        }
    },

    _closeModal() {
        document.getElementById('result-modal').classList.add('hidden');
    },

    _closeComboModal() {
        document.getElementById('combo-modal').classList.add('hidden');
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
