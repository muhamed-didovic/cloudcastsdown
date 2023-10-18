// const path = require("path");
//
// const series = require(path.resolve(process.cwd(), 'json/search-courses.json'));
// const lessons = require(path.resolve(process.cwd(), 'json/search-lessons.json'));
// const downloadedCourses = require(path.resolve(process.cwd(), 'json/downloaded-courses.json'));
// const downloadedLessons = require(path.resolve(process.cwd(), 'json/downloaded-lessons.json'));
// // console.log('111', path.resolve(process.cwd(), 'json/search-courses.json'));
// module.exports = {
//     series,
//     lessons,
//     downloadedCourses,
//     downloadedLessons
// };

import * as path from 'path';
import type { Course, Lesson } from '../types.js';
import { readFileSync } from 'fs'

const Series: Course[] = JSON.parse(readFileSync(path.resolve(process.cwd(), 'json/search-courses.json'), 'utf-8'));
const Lessons: Lesson[] = JSON.parse(readFileSync(path.resolve(process.cwd(), 'json/search-lessons.json'), 'utf-8'));
const DownloadedCourses: Course[] = JSON.parse(readFileSync(path.resolve(process.cwd(), 'json/downloaded-courses.json'), 'utf-8'));
const DownloadedLessons: Lesson[] = JSON.parse(readFileSync(path.resolve(process.cwd(), 'json/downloaded-lessons.json'), 'utf-8'));


// const Series: Course[] = require(path.resolve(process.cwd(), 'json/search-lessons.json')) as any;
// const Lessons: Lesson[] = require(path.resolve(process.cwd(), 'json/search-lessons.json')) as any;
// const DownloadedCourses: Course[] = require(path.resolve(process.cwd(), 'json/downloaded-courses.json')) as any;
// const DownloadedLessons: Lesson[] = require(path.resolve(process.cwd(), 'json/downloaded-lessons.json')) as any;

export {
  Series,
  Lessons,
  DownloadedCourses,
  DownloadedLessons
};
