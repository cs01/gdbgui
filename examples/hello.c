#include<stdio.h>


struct mystruct_t{
	int a;
	struct{
		float b;
		struct{
			double c;
		};
	};
};

int main(void) {
    printf("Hello World\n");

    for(int i=0; i < 3; i++)
    {
    	printf("i is %d\n", i);
    }

    struct mystruct_t s;
    s.a = 2;
    s.b = 1.9;
    s.c = 899.0;

    printf("Goodbye World\n");
    return 0;
}
