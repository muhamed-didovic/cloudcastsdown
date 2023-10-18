import { parentPort } from "worker_threads";

function fibonacci(n) {
    if (n <= 1) {
        return n;
    }

    return fibonacci(n - 1) + fibonacci(n - 2);
}

parentPort.on('message', (data) => {
    const {opts, page, directory, lesson, n = 10} = data;
    try {
        parentPort.postMessage({opts, page, directory, lesson, n});
        //const result = fibonacci(n);
        // parentPort.postMessage(result);
    } catch (error) {
        parentPort.postMessage('Error occurred while calculating Fibonacci.');
    }
});
