.DEFAULT_GOAL := build

clean:
	rm -rf release/

build:
	npm run build:deb
	
install:
	mkdir -p $(DESTDIR)/opt/spark-store/bin/
	mkdir -p $(DESTDIR)/opt/spark-store/extras/
	mkdir -p $(DESTDIR)/opt/durapps/spark-store/bin/
	mkdir -p $(DESTDIR)/usr/share/icons/
	mkdir -p $(DESTDIR)/usr/lib/
	mkdir -p $(DESTDIR)/usr/bin/
	cp -rv release/*/linux-unpacked/* $(DESTDIR)/opt/spark-store/bin/
	cp -rv release/*/linux-unpacked/extras/* $(DESTDIR)/opt/spark-store/extras/
	cp -rv tool/* $(DESTDIR)/opt/spark-store/bin/
	cp -rv pkg/usr/share/fish/ $(DESTDIR)/usr/share/
	cp -rv icons/hicolor/ $(DESTDIR)/usr/share/icons/
	cp -rv pkg/usr/share/icons/hicolor/ $(DESTDIR)/usr/share/icons/
	cp -rv pkg/usr/lib/systemd $(DESTDIR)/usr/lib/
	cp -rv pkg/usr/share/applications/ $(DESTDIR)/usr/share/
	cp -rv pkg/usr/share/polkit-1 $(DESTDIR)/usr/share/
	cp -rv pkg/usr/share/aptss $(DESTDIR)/usr/share/
	cp -rv tool/spark-store.asc $(DESTDIR)/opt/durapps/spark-store/bin/
	ln -s ../../../spark-store/extras/spark-store $(DESTDIR)/opt/durapps/spark-store/bin/spark-store