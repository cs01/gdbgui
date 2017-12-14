#include <math.h>       /* sin */
#include <iostream>
#include <unistd.h> 

#define PI 3.14159265

int main ()
{
  double angle = 0, result = 0;
  static const double RAD_TO_DEG = 3.14159265 / 180;
     while(1){
	  angle = 0; 
	  while (angle <= 360){
	    result = sin(angle * RAD_TO_DEG);
	    angle += 20;
	    std::cout << result << std::endl; 
	    usleep(100000); 
	  }
     }
 return 0; 
}
