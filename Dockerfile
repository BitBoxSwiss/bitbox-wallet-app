FROM ubuntu:16.04

ADD scripts/docker_install.sh /tmp/
RUN /tmp/docker_install.sh

ENV GOPATH /opt/go
ENV GOROOT /opt/go_dist/go
ENV PATH $GOROOT/bin:$GOPATH/bin:$PATH

RUN go get golang.org/x/tools/cmd/goimports

CMD ["bash"]