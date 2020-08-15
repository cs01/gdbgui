#include <mpi.h>
#include <stdio.h>
#include <unistd.h>
#include <string>
#include <sstream>
#include <iostream>

int main(int argc, char** argv) {
    // Initialize the MPI environment
    MPI_Init(NULL, NULL);

    // Get the number of processes
    int world_size;
    MPI_Comm_size(MPI_COMM_WORLD, &world_size);

    // Get the rank of the process
    int world_rank;
    MPI_Comm_rank(MPI_COMM_WORLD, &world_rank);

    char name_[256];
    int ret = gethostname(name_,256);
    std::string name(name_);

    if (ret == 0)
    {
        int name_max_s = name.size();
	int name_max_r = 0;

	MPI_Allreduce(&name_max_s,&name_max_r,1,MPI_INT,MPI_MAX,MPI_COMM_WORLD);
        
	std::stringstream ss;

	ss.width(10);
	ss << std::left << world_rank;
	ss.width(name_max_r);
	ss << name << std::endl;

	std::string proc_name = ss.str();

	if (world_rank == 0)
	{
		char * nodes;
		nodes = new char [proc_name.size()*world_size];
		MPI_Gather(proc_name.c_str(),proc_name.size(),MPI_CHAR,
			      nodes,proc_name.size(),MPI_CHAR,0,MPI_COMM_WORLD);
		FILE * pFile;
                pFile = fopen("nodes_name","w");
                if (pFile!=NULL)
                {
                    fputs (nodes,pFile);
                    fclose (pFile);
                }
		else
		{
		    printf("Error cannot create nodes_name \n");
		}
	}
	else
	{
            MPI_Gather(proc_name.c_str(),proc_name.size(),MPI_CHAR,
                       NULL,0,MPI_CHAR,0,MPI_COMM_WORLD);
	}
    }
    else
    {
        MPI_Abort(MPI_COMM_WORLD,-1);
    }

    // Finalize the MPI environment.
    MPI_Finalize();
}

