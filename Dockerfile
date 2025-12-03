# Start from base image node v24, see https://hub.docker.com/_/node for reference
FROM node:24

# All of our code will live under /adonix
WORKDIR /adonix

# Copy package.json over, install with frozen lockfile (don't let things update, the proper lockfile should be commited)
COPY package.json yarn.lock .
RUN yarn install --frozen-lockfile

# Copy over all code & config into image
COPY src/ src/
COPY *.md *.ts *.json .

# Build
RUN yarn build

# Expose adonix port
ENV PORT=3000
EXPOSE ${PORT}

# Start adonix!
CMD ["yarn", "start"]
