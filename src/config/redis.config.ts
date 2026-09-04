export default () => ({
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: Number(process.env.PORT ?? 6379),
  },
});