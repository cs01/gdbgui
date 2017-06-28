#include <iostream>
#include <vector>

// using namespace std;

int main(void)
{
    std::string str = "Hello World";
	std::cout << str << std::endl;

    std::vector<double> d {};
    d.push_back(1.1);
    d.push_back(2.2);
    d.push_back(3.3);
    d.push_back(4.4);
    int i = 0;
    for(auto itr = begin(d); itr != end(d); ++itr)
    {
        std::cout << *itr << std::endl;
        i++;
    }

    str = "Goodbye World";

    std::cout << str << std::endl;

    return 0;
}
