import fs from "fs-extra";

export const getPosition = function (position: number | string): string {
    return position ? `${ String(position).padStart(2, '0') }-` : ''
};

export const delay = (time: number): Promise<void> => {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    })
}
export const hasValues = (obj: object): boolean => obj && Object.keys(obj).length > 0;

const scrollToBottomBrowser = async (timeout: number, viewportN: number): Promise<void> => {
    await new Promise<void>((resolve) => {
        let totalHeight: number = 0, distance: number = 200, duration: number = 0, maxHeight: number = window.innerHeight * viewportN;
        const timer: NodeJS.Timeout = setInterval(() => {
            duration += 200;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight || duration >= timeout || totalHeight >= maxHeight) {
                clearInterval(timer);
                resolve();
            }
        }, 200);

    });
};

export const scrollToBottom = async (page: any, timeout: number, viewportN: number): Promise<void> => {
    // logger.info(`scroll puppeteer page to bottom ${viewportN} times with timeout = ${timeout}`);

    await page.evaluate(scrollToBottomBrowser, timeout, viewportN);
};

/*
const scrollToBottomBrowser = async (timeout, viewportN) => {
    await new Promise((resolve) => {
        let totalHeight = 0, distance = 200, duration = 0, maxHeight = window.innerHeight * viewportN;
        const timer = setInterval(() => {
            duration += 200;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= document.body.scrollHeight || duration >= timeout || totalHeight >= maxHeight) {
                clearInterval(timer);
                resolve();
            }
        }, 200);
    });
};*/

export const getFilesizeInBytes = async (filename: string): Promise<number> => {
    const exists = await fs.pathExists(filename);
    return exists ? (await fs.stat(filename)).size : 0;
};

export function formatBytes(bytes: number, decimals?: number): string {
    if (bytes == 0) return '0 Bytes'
    const k = 1024
    const dm = decimals || 2
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes)/Math.log(k))
    return parseFloat((bytes/Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function writeWaitingInfo(
    state: {
        percent: number;
        size: { transferred: number; total: number };
        time: { remaining: number };
        speed: number;
    },
    materialsName: string,
    ms: { update(name: string, values: { text: string; color: string }): void },
    name: string,
    { localSizeInBytes, remoteSizeInBytes }: { localSizeInBytes: number; remoteSizeInBytes: number }
): void {
    // cleanLine();
    const percent = (state.percent*100).toFixed(2)
    const transferred = formatBytes(state.size.transferred)
    const total = formatBytes(state.size.total)
    const remaining = secondsToHms(state.time.remaining)
    const speed = formatBytes(state.speed)
    const t = `Downloading: ${percent}% | ${transferred} / ${total} | ${speed}/sec | ${remaining} - ${materialsName} Found:${localSizeInBytes}/${remoteSizeInBytes}`
    ms.update(name, { text: t, color: 'blue' })
}

function secondsToHms(sec: number): string {
    const h: number = Math.floor(sec/3600)
    const m: number = Math.floor(sec%3600/60)
    const s: number = Math.floor(sec%3600%60)
    const hh: string = h < 10 ? '0' + h : String(h)
    const mm: string = m < 10 ? '0' + m : String(m)
    const ss: string = s < 10 ? '0' + s : String(s)
    return `${hh}:${mm}:${ss}`
}
