# 새 앱 웹(apps/timotalk)을 내보내는 이미지.
# 웹 빌드(dist/)는 배포 흐름(.github/workflows/deploy-cloud-run.yml)이 먼저 만들어 이 폴더에 복사해 둡니다 —
# 공용 번역 사전(app/lib/i18n)이 이 폴더 밖에 있어 Cloud Build 안에서는 빌드할 수 없기 때문입니다.
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --chown=node:node serve.mjs ./
COPY --chown=node:node dist ./dist

USER node

EXPOSE 8080

CMD ["node", "serve.mjs"]
