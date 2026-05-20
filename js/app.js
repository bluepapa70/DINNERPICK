const App = {
    location:    null,
    restaurants: [],
    excluded:    new Set(),
    radius:      500,
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
            const addr    = await LocationService.getAddressFromCoords(this.location.lat, this.location.lng);
            txt.textContent = addr;
            await this._fetchRestaurants();
        } catch (e) {
            txt.textContent = '위치를 가져올 수 없어요';
            document.getElementById('location-modal').classList.remove('hidden');
        }
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

            this.restaurants = data.documents || [];
            this._applyFilter();
        } catch (e) {
            countEl.textContent = '⚠️ 맛집을 불러오지 못했어요';
        }
    },

    _applyFilter() {
        const countEl = document.getElementById('result-count');
        const spinBtn = document.getElementById('spin-btn');
        const list    = this.restaurants.filter(r => !this.excluded.has(r.id));

        this.slot.setRestaurants(list);

        if (list.length > 0) {
            countEl.textContent = `✨ 주변 맛집 ${list.length}곳 발견!`;
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

        document.getElementById('result-modal').classList.remove('hidden');

        setTimeout(() => {
            KakaoMapService.initMiniMap(
                'mini-map',
                parseFloat(restaurant.y),
                parseFloat(restaurant.x),
                restaurant.place_name
            );
        }, 350);

        this._launchConfetti();
    },

    _closeModal() {
        document.getElementById('result-modal').classList.add('hidden');
    },

    _launchConfetti() {
        const container = document.getElementById('confetti-container');
        container.innerHTML = '';
        const colors = ['#ff6b9d', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#cc5de8', '#20c997'];

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
