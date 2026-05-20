class SlotMachine {
    constructor(reelEl, onComplete) {
        this.reel       = reelEl;
        this.onComplete = onComplete;
        this.restaurants = [];
        this.isSpinning  = false;
        this.itemHeight  = 90;
        this.copies      = 6;
    }

    setRestaurants(list) {
        this.restaurants = list;
        this._buildReel();
        this._resetPosition();
    }

    _buildReel() {
        if (!this.restaurants.length) {
            this.reel.innerHTML = '<div class="reel-item empty">😢 맛집이 없어요</div>';
            return;
        }
        let html = '';
        for (let c = 0; c < this.copies; c++) {
            for (const r of this.restaurants) {
                const cat = (r.category_name || '').split('>').pop().trim();
                html += `
                <div class="reel-item">
                    <div class="reel-emoji">${getCategoryEmoji(r.category_name)}</div>
                    <div class="reel-name">${r.place_name}</div>
                    <div class="reel-cat">${cat}</div>
                </div>`;
            }
        }
        this.reel.innerHTML = html;
    }

    _resetPosition() {
        if (!this.restaurants.length) return;
        // 시작: 2번째 복사본 첫 번째 아이템
        const offset = 2 * this.restaurants.length * this.itemHeight;
        this.reel.style.transition = 'none';
        this.reel.style.transform  = `translateY(-${offset}px)`;
    }

    spin() {
        if (this.isSpinning || !this.restaurants.length) return;
        this.isSpinning = true;

        // 랜덤 타겟
        const targetIdx  = Math.floor(Math.random() * this.restaurants.length);
        const target     = this.restaurants[targetIdx];

        // 마지막 복사본에서 타겟 아이템의 절대 인덱스
        const lastCopyIdx = (this.copies - 1) * this.restaurants.length + targetIdx;
        // 가운데 줄에 맞추기: 창 높이(270) / 2 - itemHeight / 2 = 90
        const finalOffset = lastCopyIdx * this.itemHeight - 90;

        // 레버 당기기 애니메이션
        const lever = document.getElementById('lever');
        if (lever) {
            lever.classList.add('pulled');
            setTimeout(() => lever.classList.remove('pulled'), 400);
        }

        // 스핀 시작
        this.reel.style.transition = 'transform 3.6s cubic-bezier(0.15, 0.85, 0.3, 1)';
        this.reel.style.transform  = `translateY(-${finalOffset}px)`;

        setTimeout(() => {
            this.isSpinning = false;
            // 위치 고정 후 다음 스핀을 위해 리셋
            this.reel.style.transition = 'none';
            this._resetPosition();
            this.onComplete(target);
        }, 3700);
    }
}

function getCategoryEmoji(category) {
    if (!category) return '🍽️';
    if (category.includes('한식'))            return '🍚';
    if (category.includes('중식'))            return '🥢';
    if (category.includes('일식'))            return '🍱';
    if (category.includes('분식'))            return '🍜';
    if (category.includes('치킨'))            return '🍗';
    if (category.includes('피자'))            return '🍕';
    if (category.includes('양식'))            return '🍝';
    if (category.includes('고기') || category.includes('구이')) return '🥩';
    if (category.includes('카페') || category.includes('커피')) return '☕';
    if (category.includes('패스트푸드'))      return '🍔';
    if (category.includes('해산물') || category.includes('횟집')) return '🐟';
    return '🍽️';
}
