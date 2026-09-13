// ~10 concurrent pollers hitting the same shared BullMQ/Redis queues the tests 
// themselves are exercising - real contention that was slowing actual replay-job processing 
// down enough to blow past test timeouts. Setting a very long interval here neuters that
// polling for the test run without changing the production default (10s, unaffected outside this file).
process.env.QUEUE_METRICS_POLL_INTERVAL_MS = '3600000';
