#include <stdio.h>
#include <string.h>

void say_goodbye(){
    printf("Goodbye\n");
}

struct mystruct_t{
    int value;
    char letter;
    char* string;
    struct{
        float fp;
        struct{
            double dbl;
        };
    };
    void* ptr;
    size_t struct_size;
};

int main(void) {
    printf("Hello World\n");

    int retval = 1;

    struct mystruct_t s;  // sizeof(struct mystruct_t) bytes are allocated for s, but still contain garbage
    s.value = 100;
    s.string = "pass";
    s.letter = 'P';
    s.fp = 123.4;
    s.dbl = 567.8;
    s.ptr = say_goodbye;  // address of function
    s.ptr = &say_goodbye;  // also address of function
    s.struct_size = sizeof(struct mystruct_t);

    for(int i=0; i < 2; i++){
        printf("i is %d\n", i);
    }

    if(!strcmp(s.string, "pass")){
        retval = 0;
    }

    printf("returning %d\n", retval);
    say_goodbye();
    return retval;
}
