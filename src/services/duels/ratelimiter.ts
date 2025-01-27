import { RateLimiterMemory } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiterMemory({
    points: 10, // Maximum of 10 connections
    duration: 60, // Per 60 seconds by IP
    blockDuration: 60, // Block for 60 seconds if consumed more than points
});

export default rateLimiter;
