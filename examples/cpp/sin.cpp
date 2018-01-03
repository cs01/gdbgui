#include <math.h>       /* sin */

int main ()
{
  double angle = 0, result = 0;
  static const double RAD_TO_DEG = 3.14159265 / 180;
  while (angle <= 360){
    result = sin(angle * RAD_TO_DEG);
    angle += 20;
  }
  return 0;
}
