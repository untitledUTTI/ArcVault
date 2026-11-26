import 'package:flutter/widgets.dart';

enum DeviceFormFactor {
  phone,
  tabletPortrait,
  tabletLandscape,
}

class DeviceLayoutInfo {
  const DeviceLayoutInfo({
    required this.formFactor,
    required this.width,
    required this.height,
    required this.topPadding,
    required this.bottomPadding,
    required this.keyboardInset,
  });

  final DeviceFormFactor formFactor;
  final double width;
  final double height;
  final double topPadding;
  final double bottomPadding;
  final double keyboardInset;

  bool get isPhone => formFactor == DeviceFormFactor.phone;
  bool get isTablet => !isPhone;
  bool get isTabletPortrait => formFactor == DeviceFormFactor.tabletPortrait;
  bool get isTabletLandscape => formFactor == DeviceFormFactor.tabletLandscape;
  bool get isCompact => isPhone || isTabletPortrait;

  static DeviceLayoutInfo fromContext(BuildContext context) {
    final mq = MediaQuery.of(context);
    final size = mq.size;
    final shortest = size.shortestSide;
    final DeviceFormFactor factor;
    if (shortest < 600) {
      factor = DeviceFormFactor.phone;
    } else if (size.height >= size.width) {
      factor = DeviceFormFactor.tabletPortrait;
    } else {
      factor = DeviceFormFactor.tabletLandscape;
    }
    return DeviceLayoutInfo(
      formFactor: factor,
      width: size.width,
      height: size.height,
      topPadding: mq.padding.top,
      bottomPadding: mq.padding.bottom,
      keyboardInset: mq.viewInsets.bottom,
    );
  }
}
