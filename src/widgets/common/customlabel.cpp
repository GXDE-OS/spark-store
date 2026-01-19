#include "customlabel.h"

#include <QGuiApplication>

CustomLabel::CustomLabel(QWidget *parent,
                         Qt::WindowFlags f)
    : QLabel(parent, f)
{
}

QPixmap CustomLabel::pixmap() const
{
#if QT_VERSION < QT_VERSION_CHECK(6, 0, 0)
    return *QLabel::pixmap();
#else
    return QLabel::pixmap();
#endif // QT_VERSION < QT_VERSION_CHECK(6, 0, 0)
}

void CustomLabel::setPixmap(const QPixmap &pixmap)
{
    QPixmap _pixmap = pixmap;
    _pixmap.setDevicePixelRatio(qApp->devicePixelRatio());
    _pixmap = _pixmap.scaled(size() * _pixmap.devicePixelRatio(),
                             Qt::KeepAspectRatio,
                             Qt::SmoothTransformation);

    QLabel::setPixmap(_pixmap);
}
