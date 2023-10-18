import * as path from 'path';
import fs from 'fs-extra';
import sanitize from 'sanitize-filename';

export default class FileChecker {
    static logger: { write: (arg0: string) => void; };
    static getFilesizeInBytes = async (filename: fs.PathLike) => {
        return await fs.exists(filename) ? fs.statSync(filename)["size"] : 0;
    };

    static createLogger(downloadFolder: string) {
        const logFile = path.join(downloadFolder, 'videos.txt');
        /* fs.existsSync(logFile) ?
             console.log(`File ${logFile} already exists`) :
             console.log(`File ${logFile} created`);*/
        return fs.createWriteStream(logFile, { flags: 'a' });
        // this.logger = fs.createWriteStream(logFile, { flags: 'a' });
        // return this.logger;
    };

    static write = async(downFolder: any, dest: any) => {
        // console.log('this.isCompletelyDownloaded(downFolder, dest)', this.isCompletelyDownloaded(downFolder, dest));
        if (!this.isCompletelyDownloadedWithOutSize(downFolder, dest)) {
            this.logger.write(`${dest} Size:${await this.getFilesizeInBytes(dest)}\n`);
        }
    }

    static writeWithOutSize(downFolder: any, dest: any) {
        // console.log('this.isCompletelyDownloaded(downFolder, dest)', this.isCompletelyDownloaded(downFolder, dest));
        if (!this.isCompletelyDownloadedWithOutSize(downFolder, dest)) {
            // this.createLogger(downFolder)
            // this.logger.write(`${dest}\n`);
            const videoLogger = this.createLogger(downFolder);
            videoLogger.write(`${dest}\n`);
        }
    }

    static findDownloadedVideos = async (downloadFolder: any) => {
        const logFile = `${downloadFolder}${path.sep}videos.txt`;
        if (!await fs.exists(logFile)) return [];
        return fs.readFileSync(logFile).toString().split("\n");
    }

    static isCompletelyDownloaded = async (downloadFolder: any, videoName: string, remoteSize: any) => {
        const downloadedVideos = await this.findDownloadedVideos(downloadFolder);
        if (typeof downloadedVideos === 'undefined' || downloadedVideos.length === 0) {
            return false;
        }
        videoName = `${videoName} Size:${remoteSize ?? this.getFilesizeInBytes(videoName)}`
        for (let downloadedVideoName of downloadedVideos) {
            // console.log('downloadedVideoName', videoName === downloadedVideoName, videoName,  downloadedVideoName);
            if (videoName === downloadedVideoName) {
                return downloadedVideoName;
            }
        }
        return false;
    }

    static isCompletelyDownloadedWithOutSize = async(downloadFolder: string, videoName: string) => {
        const downloadedVideos = await this.findDownloadedVideos(downloadFolder);
        if (typeof downloadedVideos === 'undefined' || downloadedVideos.length === 0) {
            return false;
        }
        videoName = `${videoName}`
        for (let downloadedVideoName of downloadedVideos) {
            // console.log('downloadedVideoName', videoName === downloadedVideoName, videoName,  downloadedVideoName);
            if (videoName === downloadedVideoName) {
                return true;//downloadedVideoName;
            }
        }
        return false;
    }

    static addPageAsDownloaded(course: { title: any; }, opts: { dir: string; }, index: number, lesson: { title: any; }) {
        let series = sanitize(course.title)
        const dest = path.join(opts.dir, series, `${String(index + 1).padStart(2, '0')}-${lesson.title}`)
        const videoLogger = this.createLogger(path.join(opts.dir, series));
        videoLogger.write(`${dest}\n`);
    }

    static fileIsDownloaded(course: { title: any; }, opts: { dir: string; }, index: number, lesson: { title: any; }) {
        let series = sanitize(course.title)
        const dest = path.join(opts.dir, series, `${String(index + 1).padStart(2, '0')}-${lesson.title}`)
        let isDownloaded = this.isCompletelyDownloadedWithOutSize(path.join(opts.dir, series), dest)
        // console.log('isDownloaded', isDownloaded, lesson.title);
        return isDownloaded;
    }

    findNotExistingVideo = async(videos: any, downloadFolder: any) => {
        let i = 0;
        for (let video of videos) {
            const name = video.name.toString().replace(/[^A-Za-zА-Яа-я\d\s]/gmi, '').replace('Урок ', '');
            let filename = `${downloadFolder}${path.sep}${name}.mp4`;
            if (await fs.exists(filename) && await FileChecker.isCompletelyDownloaded(downloadFolder, name, video.size)) {
                console.log(`File "${name}" already exists`);
                i++;
            } else {
                break;
            }
        }
        return i;
    };
}


/*module.exports = {
    findNotExistingVideo,
    isCompletelyDownloaded,
    createLogger
}*/
