FROM kong/kong:3.9.1
COPY kong-entrypoint.sh /home/kong/kong-entrypoint.sh
COPY kong.yml /home/kong/temp.yml
USER root
RUN chmod +x /home/kong/kong-entrypoint.sh
USER kong
ENTRYPOINT ["/home/kong/kong-entrypoint.sh"]
