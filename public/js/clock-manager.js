class ClockManager {
    constructor() {
        this.elements = {
            clockContent: app.utils.dom.$('.clock-content'),
            dateElement: app.utils.dom.$('.clock-content .date'),
            timeElement: app.utils.dom.$('.clock-content .time')
        };
        
        this.updateInterval = null;
        this.initializeClock();
    }

    initializeClock() {
        this.updateTime();
        this.updateInterval = setInterval(() => this.updateTime(), 1000);
    }

    updateTime() {
        if (!this.elements.clockContent) {
            console.error('找不到时钟元素');
            return;
        }
        
        const now = new Date();
        
        // 更新日期
        if (this.elements.dateElement) {
            const dateStr = now.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                weekday: 'long'
            });
            this.elements.dateElement.textContent = dateStr;
        }
        
        // 更新时间
        if (this.elements.timeElement) {
            const timeStr = now.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            
            const [hours, minutes, seconds] = timeStr.split(':');
            this.elements.timeElement.innerHTML = `${hours}:${minutes}<span class="seconds">${seconds}</span>`;
        }
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// 导出
window.app = window.app || {};
window.app.ClockManager = ClockManager; 