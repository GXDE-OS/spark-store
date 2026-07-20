.DEFAULT_GOAL := build

clean:
	rm -rf release/
	rm -f lightningcss-linux-loong64-gnu.tgz
	rm -f tailwindcss-oxide-linux-loong64-gnu.tgz

build:
ifeq (${DEB_HOST_ARCH},loong64)
	# Install oxide for loongarch64
	curl -fsSL https://github.com/loong64/tailwindcss/releases/download/v4.3.2/tailwindcss-oxide-linux-loong64-gnu.tgz -o tailwindcss-oxide-linux-loong64-gnu.tgz
	mkdir -p $(CURDIR)/node_modules/@tailwindcss/oxide-linux-loong64-gnu
	tar xf tailwindcss-oxide-linux-loong64-gnu.tgz -C $(CURDIR)/node_modules/@tailwindcss/oxide-linux-loong64-gnu --strip-components 1
	rm tailwindcss-oxide-linux-loong64-gnu.tgz
	# Install lightningcss-linux-loong64-gnu for loongarch64
	curl -fsSL https://github.com/loong64/lightningcss/releases/download/v1.32.0/lightningcss-linux-loong64-gnu-1.32.0.tgz -o lightningcss-linux-loong64-gnu.tgz
	mkdir -p $(CURDIR)/node_modules/lightningcss-linux-loong64-gnu
	tar xf lightningcss-linux-loong64-gnu.tgz -C $(CURDIR)/node_modules/lightningcss-linux-loong64-gnu --strip-components 1
	rm lightningcss-linux-loong64-gnu.tgz
	npm run build:loong64
else
	npm run build
endif
	
install:
	mkdir -p $(DESTDIR)/opt/spark-store/bin/
	mkdir -p $(DESTDIR)/opt/spark-store/extras/
	mkdir -p $(DESTDIR)/opt/durapps/spark-store/bin/
	mkdir -p $(DESTDIR)/usr/share/icons/
	mkdir -p $(DESTDIR)/usr/lib/
	mkdir -p $(DESTDIR)/usr/bin/
	mkdir -p $(DESTDIR)/etc/apt/
	mkdir -p $(DESTDIR)/lib/systemd/
	mkdir -p $(DESTDIR)/tmp/
	cp -rv release/*/linux*-unpacked/* $(DESTDIR)/opt/spark-store/bin/
	cp -rv release/*/linux*-unpacked/extras/* $(DESTDIR)/opt/spark-store/extras/
	cp -rv tool/* $(DESTDIR)/opt/durapps/spark-store/bin/
	cp -rv pkg/usr/share/fish/ $(DESTDIR)/usr/share/
	cp -rv icons/hicolor/ $(DESTDIR)/usr/share/icons/
	cp -rv pkg/usr/share/icons/hicolor/ $(DESTDIR)/usr/share/icons/
	cp -rv pkg/usr/lib/systemd $(DESTDIR)/usr/lib/
	cp -rv pkg/usr/share/applications/ $(DESTDIR)/usr/share/
	cp -rv pkg/usr/share/polkit-1 $(DESTDIR)/usr/share/
	cp -rv pkg/usr/share/aptss $(DESTDIR)/usr/share/
	cp -rv pkg/usr/share/ssinstall/ $(DESTDIR)/usr/share/
	cp -rv pkg/usr/share/ssinstall-local/ $(DESTDIR)/usr/share/
	cp -rv pkg/usr/share/dsg/ $(DESTDIR)/usr/share/
	cp -rv pkg/usr/share/bash-completion/ $(DESTDIR)/usr/share/
	cp -rv tool/spark-store.asc $(DESTDIR)/opt/durapps/spark-store/bin/
#	ln -s ../../../spark-store/extras/spark-store $(DESTDIR)/opt/durapps/spark-store/bin/spark-store
