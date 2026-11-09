FROM postgres:17-alpine
RUN apk add --no-cache rsync age curl openssh-client tzdata
COPY lib.sh backup.sh prune.sh restore-test.sh entrypoint.sh /usr/local/bin/
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/*.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]