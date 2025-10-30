# Use the official Node.js image as the base image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install -g node-pre-gyp && npm install && npm install -g typescript

RUN apk add --no-cache curl

# Copy the rest of the application code
COPY . .

# Build the NestJS application
RUN npm run build:prod

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
