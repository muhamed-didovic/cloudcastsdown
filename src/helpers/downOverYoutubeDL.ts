import path from 'path';
import fs from 'fs-extra';
// @ts-ignore
import colors from 'colors';
// import {pRetry} from '@byungi/p-retry';
// import {pDelay} from '@byungi/p-delay';
// import createLogger from "./helpers/createLogger.js";
import logger from './logger.js';
import FileChecker from './fileChecker.js';

// import ytDlp from "./ytdlp.cjs"
// import async from 'async';

// @ts-ignore
import Spinnies from "dreidels";
const ms = new Spinnies();
// import remote from "remote-file-size";
import {formatBytes, getFilesizeInBytes} from "./helper.js";
import { CancelablePromise } from '@byungi/promise-helpers';

//how import ytdown from yt.cts file
import ytdown from "./yt.js";

/**
 * Retries the given function until it succeeds given a number of retries and an interval between them. They are set
 * by default to retry 5 times with 1sec in between. There's also a flag to make the cooldown time exponential
 * @author Daniel Iñigo <danielinigobanos@gmail.com>
 * @param {Function} fn - Returns a promise
 * @param {Number} retriesLeft - Number of retries. If -1 will keep retrying
 * @param {Number} interval - Millis between retries. If exponential set to true will be doubled each retry
 * @param {Boolean} exponential - Flag for exponential back-off mode
 * @return {Promise<*>}
 */
async function retry(fn: () => any, retriesLeft = 5, interval = 1000, exponential = false) {
    try {
        const val = await fn();
        return val;
    } catch (error) {
        if (retriesLeft) {
            logger.warn('.... 11cluster retrying left (' + retriesLeft + ')');
            logger.warn('retrying err', error);
            await new Promise(r => setTimeout(r, interval));
            return retry(fn, retriesLeft - 1, exponential ? interval * 2 : interval, exponential);
        } else {
            logger.error('Max retries reached');
            throw error
            //throw new Error('Max retries reached');
        }
    }
}

/*const download = (url, dest, localSizeInBytes, remoteSizeInBytes, downFolder, index = 0, ms) => {
    return new Promise(async (resolve, reject) => {
        const videoLogger = createLogger(downFolder);

        // await fs.remove(dest) // not supports overwrite..
        ms.update(dest, {
            text: `to be processed by yt-dlp... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`,
            color: 'blue'
        });
        logger.debug(`to be processed by yt-dlp... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`)

        return await retry(async () => {//return
            const youtubeDlWrap = new youtubedl()
            let youtubeDlEventEmitter = youtubeDlWrap
                .exec([
                    url,
                    '--all-subs',
                    '--referer', 'https://fireship.io/',
                    "-o", path.toNamespacedPath(dest),
                    '--socket-timeout', '5',
                ])
                .on("progress", (progress) => {
                    ms.update(dest, {text: `${index}. Downloading: ${progress.percent}% of ${progress.totalSize} at ${progress.currentSpeed} in ${progress.eta} | ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`})
                })
                // .on("youtubeDlEvent", (eventType, eventData) => console.log(eventType, eventData))
                .on("error", (error) => {
                    // ms.remove(dest, { text: error })
                    logger.error('error--', error)
                    logger.error('error for url:', url);
                    ms.remove(dest);
                    /!*fs.unlink(dest, (err) => {
                        reject(error);
                    });*!/
                    reject(error);

                })
                .on("close", () => {
                    logger.info(`${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`)
                    ms.succeed(dest, {text: `${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`})//.split('/').pop()
                    // ms.remove(dest);
                    // console.log(`${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${remoteSizeInBytes} - Size:${formatBytes(getFilesizeInBytes(dest))}`.green);
                    videoLogger.write(`${dest} Size:${getFilesizeInBytes(dest)}\n`);
                    resolve()
                })

        }, 6, 2e3, true)


    });
};*/

/* const downloadVideo = async (url, dest, {
    localSizeInBytes,
    remoteSizeInBytes,
    downFolder,
    index = 0,
    ms
}) => {
    try {
        await pRetry(
            () => download(url, dest,
                {
                    localSizeInBytes,
                    remoteSizeInBytes,
                    downFolder,
                    index,
                    ms
                }),
            {
                retries        : 3,
                onFailedAttempt: error => {
                    console.log(`Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`);
                    // 1st request => Attempt 1 failed. There are 4 retries left.
                    // 2nd request => Attempt 2 failed. There are 3 retries left.
                    // …
                }
            })
    } catch (e) {
        console.log('eeee', e);
        ms.remove(dest, { text: `Issue with downloading` });
    }
} */

const newDownload = (url: any, dest: string, localSizeInBytes: string, remoteSizeInBytes: string, downFolder: any, index: string | number, logger: any, ms: any) => {
    return new Promise(async (resolve, reject) => {
        // const videoLogger = createLogger(downFolder);
        logger.debug('DOWNLOADING:', url, 'localSizeInBytes:', localSizeInBytes, 'remoteSizeInBytes:', remoteSizeInBytes);
        // await fs.remove(dest) // not supports overwrite..
        ms.update(dest, {
            text: `to be processed by yt-dlp... ${dest.split('/').pop()} Found:${localSizeInBytes}/${remoteSizeInBytes}`,
            color: 'blue'
        });

        await ytdown(url, dest, ms, index, localSizeInBytes, remoteSizeInBytes, logger, downFolder, resolve, reject)
    });
};

// const slowForever = async (runner: { (): Promise<unknown>; (): PromiseLike<unknown> | CancelablePromise<unknown>; }) => {
//     const [res] = await Promise.all([pRetry(runner, {retries: 10, interval: 2000}), pDelay(1000)])//{retries: Infinity, interval: 30000}
//     return res
// }

type DownloadProps = {
    overwrite?: string;
    downFolder: string;
    index?: string | number;
    ms?: any;
};
/**
 * @param file
 * @param {import("fs").PathLike} dest
 * @param overwrite
 * @param downFolder
 * @param index
 * @param ms
 */
export default async (file: { url: any; size: any; }, dest: string, {overwrite = '', downFolder, index = ''}: DownloadProps) => {
    const url = file.url;
    let remoteFileSize = file.size;
    logger.info(`[downOverYoutubeDL] Checking if video is downloaded: ${dest}`);//.split('/').pop()
    ms.add(dest, {text: `Checking if video is downloaded: ${dest.split('/').pop()}`})//

    // let isDownloaded = false;
    let localSize = await getFilesizeInBytes(`${dest}`)
    let localSizeInBytes = formatBytes(await getFilesizeInBytes(`${dest}`))
    // isDownloaded = isCompletelyDownloaded(downFolder, dest)
    let isDownloaded = await FileChecker.isCompletelyDownloadedWithOutSize(downFolder, dest)
    logger.debug('[downOverYoutubeDL] isDownloaded>>>>', isDownloaded);
    // if (remoteFileSize === localSize || isDownloaded) {
    if (isDownloaded && overwrite === 'no') {
        ms.succeed(dest, {text: `${index}. Video already downloaded: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)}`});
        //ms.remove(dest);
        logger.debug(`[downOverYoutubeDL] ${index}. Video already downloaded: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)}`.blue);
        return;
    } else {
        ms.update(dest, {text: `${index} Start download video: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)} `});
        logger.debug(`[downOverYoutubeDL] ${index} Start ytdl download: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(remoteFileSize)} `);

        /*await slowForever(async () => await newDownload(
                url,
                dest,
                localSizeInBytes,
                formatBytes(remoteFileSize), //remoteSizeInBytes: formatBytes(remoteFileSize),
                downFolder,
                index,
                logger,
                ms
            )
        )*/
        await newDownload(
            url,
            dest,
            localSizeInBytes,
            formatBytes(remoteFileSize), //remoteSizeInBytes: formatBytes(remoteFileSize),
            downFolder,
            index,
            logger,
            ms
        )
        ms.succeed(dest, {text: `${index}. End download ytdl: ${dest} Found:${localSizeInBytes}/${formatBytes(remoteFileSize)} - Size:${formatBytes(await getFilesizeInBytes(dest))}`})//.split('/').pop()
        logger.info('[downOverYoutubeDL] remove spinner:', dest)
        // ms.remove(dest)
    }
}

