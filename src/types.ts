// Type definition for a Logger object used in the scrape function
export type Logger = {
    log: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    isLogger: boolean;
}

// types.ts

// Interface for the options object passed to the scrape function
export interface ScrapeOpts {
    email: string;
    password: string;
    concurrency?: number;
    logger?: Logger | null;
    dir: string;
    file?: boolean;
    filePath?: string;
    all?: boolean;
    courseUrl?: string;
    headless?: string | boolean;
    source?: string;
    overwrite?: boolean;
}

export type CourseSearch = {
    title: string;
    value: string;
    url: string;
};

export interface CourseData {
    courses: Course[];
}
export interface Course {
    series?: string | undefined;
    title: string;
    value?: string;
    url?: string;
    slug: string;
    downPath?: string;
    done?: any;
    course?: string
};


export interface Lesson {
    url: string;
    slug: string;
    order: string;
    title: string;
    series: string;
    position: string;
    course?: string;
    value: string;
    downPath?: string;
};

export interface Opts {
    all: string;
    headless: string;
    logger: any;
    file: boolean;
    filePath: string;
    courseUrl: string;
    source: string;
    dir?: string;
    overwrite: boolean;
    concurrency: number;
};
