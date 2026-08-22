FROM mcr.microsoft.com/playwright:v1.62.1-noble AS dependencies
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM dependencies AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn build

FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN groupadd --system --gid 10001 appuser && useradd --system --uid 10001 --gid appuser appuser
COPY --from=build --chown=appuser:appuser /app/package.json /app/yarn.lock ./
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/.next ./.next
COPY --from=build --chown=appuser:appuser /app/public ./public
COPY --from=build --chown=appuser:appuser /app/db ./db
COPY --from=build --chown=appuser:appuser /app/scripts ./scripts
USER appuser
EXPOSE 3000
CMD ["yarn", "start:prod"]
