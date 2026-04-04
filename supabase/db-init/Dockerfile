FROM postgres:15-alpine
COPY init.sh /init.sh
COPY buckets-init.sh /buckets-init.sh
COPY sql/ /sql/
RUN chmod +x /init.sh /buckets-init.sh
ENTRYPOINT ["/init.sh"]
