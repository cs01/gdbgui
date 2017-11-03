#include <iostream>
#include <vector>
#include <map>

int main(void)
{
    std::cout << "Hello World" << std::endl;

    std::cout << "Example vector" << std::endl;
    std::vector<double> myvector {};
    myvector.push_back(1.1);
    myvector.push_back(2.2);
    myvector.push_back(3.3);
    myvector.push_back(4.4);
    for (auto i : myvector){
        std::cout << i << " is an element in a vector" << std::endl;
    }

    std::cout << "Example map" << std::endl;
    std::map<char,int> mymap;
    mymap['a'] = 10;
    mymap['b'] = 30;
    mymap['c'] = 50;
    mymap['d'] = 70;
    for (auto i : mymap){
        std::cout << i.first << " is a key in a map with a value of " << i.second << std::endl;
    }

    return 0;
}
