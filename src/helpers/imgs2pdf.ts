import PDFDocument from "pdfkit";
import fs from "fs-extra";
import * as path from "path";
import logger from './logger.js';
import {imageSize} from 'image-size'

const folderContents = async (folder: string) => {
    const files = await fs.readdir(folder)
    // console.log('files', files);
    if (!files.length) {
        return logger.debug('[img2Pdf] No images found');
    } else {
        logger.debug(`[img2Pdf] found files: ${files.length} in folder: ${folder}`);
    }

    let f =  files
        .filter(file => file.includes('.png'))
        .map(file => {
            return path.join(folder, file)
        });
    logger.debug(`[img2Pdf] Creating PDF file from ${f.length} images found in folder: ${folder}...`);
    return f;
}
const convert = (imgs: any, dest: string) => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false })

    doc.pipe(fs.createWriteStream(dest))
        .on('finish', resolve)
        .on('error', reject)

    for (const img of imgs) {
        const dimensions = imageSize(img);
        const width = dimensions.width || 0;
        const height = dimensions.height || 0;
        doc.addPage({ size: [width, height] }).image(img, 0, 0)
    }

    doc.end()
})

export default async (sourcePath: any, savePath: string) => {
    //const savePath = path.join(process.cwd(), saveDir, courseName, 'screens');
    // console.log('savePath', savePath);
    // await fs.ensureDir(savePath)
    return Promise
        .resolve()
        .then(async () => await folderContents(sourcePath))
        .then(async (imgs) => {
            // console.log('--imgs', imgs);
            if (!imgs.length) {
                logger.warn('[img2Pdf] No images found for PDF!!!');
                return Promise.resolve()
            }
            await convert(imgs, path.resolve(savePath))
            logger.info(`[img2Pdf] PDF created at: ${sourcePath} - ${savePath}`);
            return 'Done';
        })
    //.catch(console.error)

}//();


