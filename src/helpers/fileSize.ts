//@ts-ignore
import remote from "remote-file-size";

const getFileSize = (opts: any) => {
  return new Promise((resolve, reject) => {
    remote(opts, function (err: any, size: any) {
      if (err) reject(err)
      resolve(size)
    })
  })
}

module.exports = getFileSize
