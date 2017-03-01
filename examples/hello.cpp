#include <iostream>
#include <vector>

// using namespace std;

int main(void)
{
    std::string str = "Hello World";
	std::cout << str << std::endl;

    std::vector<double> d {1.1, 2.2, 3.3, 4.4};

    for(auto itr = begin(d); itr != end(d); ++itr)
    {
        std::cout << *itr << std::endl;
    }

    str = "Goodbye World";

    std::cout << str << std::endl;

    return 0;
}
