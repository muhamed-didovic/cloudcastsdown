// import got from 'got';
import logger from './logger.js';
import { extend } from './utils/index.js';
import fetch from "node-fetch";

function getMimeType(contentType) {
    return contentType ? contentType.split(';')[0] : null;
}

function defaultResponseHandler({ response }) {
    return Promise.resolve(response);
}

function extractEncodingFromHeader(headers) {
    const contentTypeHeader = headers.get('content-type') //headers['content-type'];
    return contentTypeHeader && contentTypeHeader.includes('utf-8') ? 'utf8' : 'binary';
}

function getEncoding(response) {
    if (response && typeof response === 'object') {
        if (response.headers && typeof response.headers === 'object') {
            return extractEncodingFromHeader(response.headers);
        } else if (response.encoding) {
            console.log('[getEncoding]::', response.encoding);
            return response.encoding;
        }
    }

    return 'binary';
}

function throwTypeError(result) {
    let type = typeof result;

    if (result instanceof Error) {
        throw result;
    } else if (type === 'object' && Array.isArray(result)) {
        type = 'array';
    }

    throw new Error(`Wrong response handler result. Expected string or object, but received ${ type }`);
}

async function getData(result) {
    // console.log('r111esult', result);
    let data = result;
    if (result && typeof result === 'object' && 'body' in result) {
        // console.log('112121212', await result.buffer());
        // data = await result.buffer(); //result.body;
        data = await result.arrayBuffer(); //result.body;
        // data =  Buffer.from(data).toString('binary');
        // data = await result.text();
    }

    return data;
}

async function transformResult(result) {
    const encoding = getEncoding(result);
    // console.log('encoding', encoding);
    const data = await getData(result);
    // console.log('data', data);
    // Check for no data
    if (data === null || data === undefined) {
        return null;
    }

    // Then stringify it.
    let body = null;
    if (data instanceof ArrayBuffer) {
    // if (data instanceof Buffer) {
    //     body = data.toString(encoding);
    //     const decoder = new TextDecoder('utf-8');
    //     body = decoder.decode(data);
        body = Buffer.from(data)
    } else if (data instanceof Buffer) {
        body = data.toString(encoding);
    } else if (typeof data === 'string') {
        body = data;
    } else {
        throwTypeError(result);
    }

    return {
        body,
        encoding,
        metadata: result.metadata || data.metadata || null
    };
}

async function getRequest({ url, referer, options = {}, afterResponse = defaultResponseHandler }) {
    // console.log('args', arguments);
    // const requestOptions = extend(options, { url });
    const requestOptions = options//extend(options, { url });

    // console.log('requestOptions', requestOptions);
    if (referer) {
        requestOptions.headers = requestOptions.headers || {};
        requestOptions.headers.referer = referer;
    }

    // logger.debug(`[request] sending request for url ${ url }, referer ${ referer }`);

    const response = await fetch(url, requestOptions);
    // console.log('1111212222211111', response.headers.get('content-type'));
    // logger.debug(`[request] received response for ${ response.url }, statusCode ${ response.statusCode }`);
    const responseHandlerResult = await transformResult(await afterResponse({ response }));
    // console.log('responseHandlerResult', responseHandlerResult);
    if (!responseHandlerResult) {
        return null;
    }
    return {
        url: response.url,
        mimeType: getMimeType(response.headers.get('content-type')),
        body: responseHandlerResult.body,
        metadata: responseHandlerResult.metadata,
        encoding: responseHandlerResult.encoding
    };
}


export default {
    get: getRequest,
    getEncoding,
    transformResult,
};
