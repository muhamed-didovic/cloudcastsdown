declare module 'website-scraper-existing-directory' {
    import { Options } from 'website-scraper';

    export default function websiteScraperExistingDirectory(
        options: Options,
        callback: (err: Error | null, results: any) => void
    ): void;
}
