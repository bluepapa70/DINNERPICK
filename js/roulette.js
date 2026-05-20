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
        const offset = 2 * this.restaurants.length * this.itemHeight;
        this.reel.style.transition = 'none';
        this.reel.style.transform  = `translateY(-${offset}px)`;
    }

    spin() {
        if (this.isSpinning || !this.restaurants.length) return;
        this.isSpinning = true;

        const targetIdx   = Math.floor(Math.random() * this.restaurants.length);
        const target      = this.restaurants[targetIdx];
        const lastCopyIdx = (this.copies - 1) * this.restaurants.length + targetIdx;
        const finalOffset = lastCopyIdx * this.itemHeight - 90;

        this.reel.style.transition = 'transform 3.6s cubic-bezier(0.15, 0.85, 0.3, 1)';
        this.reel.style.transform  = `translateY(-${finalOffset}px)`;

        setTimeout(() => {
            this.isSpinning = false;
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
