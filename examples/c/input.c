#include <stdio.h>
#include <string.h>

int main(int argc, char **argv)
{
    char name[20];
    printf("Hello. What's your name?\n");
    fgets(name, 20, stdin);
    printf("Hi there, %s", name);
    return 0;
}
