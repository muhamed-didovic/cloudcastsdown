import * as path from 'path';
import * as fs from 'fs-extra';;
import logger from './logger.js';
import {formatBytes} from './helper.js';
import FileChecker from './fileChecker.js';
// import {MultiProgressBars} from 'multi-progress-bars';
import {mpbDown} from './yt.cjs';
// import YTDlpWrap from 'yt-dlp-wrap';
// import YTDlpWrap from '../helpers/ytdlp.cjs';
// import Promise from 'bluebird';

import request from 'requestretry';
import async from "async";
// const req = require('requestretry');
// const j = req.jar();
// const request = req.defaults({
//     jar: j,
//     retryDelay: 500,
//     fullResponse: true,
// });
//
// const mpb = new MultiProgressBars({
//     initMessage: ' Firerip ',
//     anchor: "top",
//     persist: true,
//     progressWidth: 40,
//     numCrawlers: 7,
//     border: true,
// });

const getFilesizeInBytes = (filename: fs.PathLike) => {
    return fs.existsSync(filename) ? fs.statSync(filename)["size"] : 0;
};

// type DownloadChapter = (url: string, dest: string, cb: (progress: any) => void) => Promise<void>;

const downloadChapter = async (url: any, dest: string, cb: (progress: any) => void) => {//
    return await mpbDown(url, dest, cb);
    // const ytDlpWrap: any = new YTDlpWrap();
    // return new Promise((resolve, reject) => {
    //     ytDlpWrap
    //         .exec([
    //             url,
    //             "--write-subs",
    //             "--write-auto-sub",
    //             '--referer', 'https://fireship.io/',
    //             "-o", path.resolve(dest),
    //             '--socket-timeout', '5'
    //         ])
    //         .on("progress", cb)
    //         .on("error", (err) => reject(err))
    //         .on("close", () => resolve())
    // });
};

// type GetSizeOfVideo = (course: any) => Promise<{ url: string, size: string }>;

const getSizeOfVideo = async (course: unknown) => {//: GetSizeOfVideo
    const vimeoUrl = course.vimeoUrl;
    try {
        const {
            headers,
            attempts
        } = await request({
            url: vimeoUrl,
            json: true,
            maxAttempts: 50,
            method: 'HEAD',
            fullResponse: true,
        });
        return {
            url: vimeoUrl,
            size: headers['content-length']
    }
    } catch (err) {
        logger.error('getSizeOfVideo ERR::', err);
        throw err
    }
};

// type DownloaderProps = {
//     mpb: any;
//     chapters: any[];
//     concurrency: number;
//     file: any;
//     filePath: fs.PathLike;
//     dir: string;
//     overwrite?: string;
// };

const downloader = async (opts: { mpb: any; chapters: any; concurrency: any; file: any; filePath: any; dir: any; overwrite?: "" | undefined; }) => {
    const {
        mpb,
        chapters,
        concurrency,
        file,
        filePath,
        dir,
        overwrite = '',
    } = opts;
    let cnt = 1;
    await async.mapLimit(chapters, concurrency, async (chapter, index) => {
        if (chapter.done) {
            logger.debug('DONE for:', chapter.title);
            cnt++;
            return;
        }

        if (!chapter?.downPath) {
            logger.debug('DDDDest:', dir, chapter);
            logger.debug('CCCCC', chapter);
        }

        const dest = path.join(dir, chapter.downPath);
        fs.ensureDir(dest);

        const details = await getSizeOfVideo(chapter);

        let isDownloaded = false;
        let localSize = getFilesizeInBytes(`${dest}`);
        let localSizeInBytes = formatBytes(getFilesizeInBytes(`${dest}`));
        isDownloaded = FileChecker.isCompletelyDownloadedWithOutSize(dest, path.join(dest, chapter.title));
        logger.debug('Is downloaded:', isDownloaded);

        if (isDownloaded && overwrite === 'no') {
            logger.debug(`${index}. Video already downloaded: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(details.size)}`.blue);
            return;
        } else {
            logger.debug(`${index} Start ytdl download: ${dest.split('/').pop()} - ${localSizeInBytes}/${formatBytes(details.size)}`);

            mpb.addTask(chapter.title, {type: "percentage", message: `${cnt} - ${chapter.title}`});

            await downloadChapter(details.url, path.join(dest, chapter.title), (progress: { percent: number; }) => {
                mpb.updateTask(chapter.title, {percentage: progress.percent / 100});
            });

            mpb.done(chapter.title, {message: `${cnt} - ${chapter.title} - Downloaded successfully.`});
            // setTimeout(() => mpb.removeTask(chapter.title), 3000);
        }

        if (file) {
            chapters[index].done = true;
            await fs.writeFile(filePath, JSON.stringify(chapters, null, 2), 'utf8');
        }
        cnt++;
    });
    //, {
    //         concurrency//: 1
    //     }
};

export default downloader;
