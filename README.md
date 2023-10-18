# Downloader and scraper for cloudcasts.io and pro members

[![npm](https://badgen.net/npm/v/cloudcastsdown)](https://www.npmjs.com/package/cloudcastsdown)
[![Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2Fmuhamed-didovic%2Fcloudcastsdown&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false)](https://hits.seeyoufarm.com)
[![license](https://flat.badgen.net/github/license/muhamed-didovic/cloudcastsdown)](https://github.com/muhamed-didovic/cloudcastsdown/blob/master/LICENSE)

## Requirement (ensure that you have it installed)
- Bun (https://bun.sh/)
- yt-dlp (https://github.com/yt-dlp/yt-dlp)

todo:
lessons' videos are not saved
## Install
```sh
bun i -g cloudcastsdown
```

#### without Install
```sh
bunx cloudcastsdown
```

## CLI
```sh
Usage
    $ cloudcastsdown [CourseUrl]

Options
    --email, -e         Your email.
    --password, -p      Your password.
    --directory, -d     Directory to save.
    --source, -s        Download articles or courses (Default: courses)
    --file, -f          Location of the file where are the courses
    --overwrite, -o     Overwrite if resource exists (values: 'yes' or 'no'), default value is 'no'
    --headless, -h      Enable headless (values: 'yes' or 'no'), default value is 'yes'
    --videos, -v        Enable video download (values: 'yes' or 'no'), default value is 'no'
    --concurrency, -c

Examples
    $ cloudcastsdown
    $ cloudcastsdown -a
    $ cloudcastsdown [url] [-e email] [-p password] [-d dirname] [-d dirname] [-c number] [-f path-to-file] [-h yes/no]
```

## License
MIT
