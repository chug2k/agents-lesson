# Fast Track hub + agents lesson, one nginx image.
FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY hub/ /usr/share/nginx/html/
COPY index.html /usr/share/nginx/html/agents/index.html
COPY week2/walkthrough/ /usr/share/nginx/html/agents/week2/walkthrough/
COPY hub-pages/week2.html /usr/share/nginx/html/agents/week2/index.html
COPY week3/walkthrough/ /usr/share/nginx/html/agents/week3/walkthrough/
COPY hub-pages/week3.html /usr/share/nginx/html/agents/week3/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
