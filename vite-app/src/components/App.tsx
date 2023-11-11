import { useEffect, useState } from 'react'
import { store, useGlobalValue } from './Store'
import FileOps from './FileOps'
import GlobalEvents from './GlobalEvents'
import HoverVar from './HoverVar'
import { Modal } from './GdbguiModal'
import { RightSidebar } from './RightSidebar'
import ToolTip from './ToolTip'
import { debug, InitialData } from './InitialData'
import { ReflexContainer, ReflexSplitter, ReflexElement } from 'react-reflex'
import { GdbTerminal } from './GdbTerminal'
import { InferiorTerminal } from './InferiorTerminal'
import { GdbGuiTerminal } from './GdbGuiTerminal'
import { Nav } from './Nav'
import { GdbguiEditor } from './GdbguiEditor'
import { Footer } from './Footer'
import { GdbWebsocket } from './Websocket'
import 'react-reflex/styles.css'
import { SourceFileTabs } from './SourceFileTabs'

export function Gdbgui() {
  const [initialData, setInitialData] = useState<Nullable<InitialData>>(null)
  const [error, setError] = useState<Nullable<string>>(null)

  useEffect(() => {
    async function initialize() {
      const response = await fetch('/initial_data')
      if (!response.ok) {
        setError(JSON.stringify(response, null, 3))
      }
      try {
        const initialData: InitialData = await response.json()
        const gdbWebsocket = new GdbWebsocket(
          initialData.gdb_command,
          initialData.gdbpid
        )
        store.set<typeof store.data.gdbWebsocket>('gdbWebsocket', gdbWebsocket)
        GlobalEvents.init()
        FileOps.init()
        setInitialData(initialData)
      } catch (e) {
        console.error(e)
        setError(
          `Failed to parse initial data from gdbgui server. Is it running? Error: ${String(
            e
          )}`
        )
      }
    }
    initialize()
  }, [])

  if (error) {
    return (
      <div className=" h-screen w-screen bg-gray-900  text-red-800 text-2xl text-center">
        <div className="w-full  ">
          <div className="py-10">
            gdbgui failed to connect to the server. Is it still running?
          </div>
          <div className="pt-10">
            <pre>{error}</pre>
          </div>
        </div>
      </div>
    )
  }

  if (!initialData) {
    return (
      <div className="flex-col h-screen w-screen bg-gray-900  text-gray-800 text-9xl text-center">
        <div className="w-full">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen text-gray-300 bg-black">
      <HoverVar />
      <Modal />
      <ToolTip />
      <textarea
        style={{
          width: '0px',
          height: '0px',
          position: 'absolute',
          top: '0',
          left: '-1000px'
        }}
        ref={(node) => {
          store.set<typeof store.data.textarea_to_copy_to_clipboard>(
            'textarea_to_copy_to_clipboard',
            node
          )
        }}
      />
      <ReflexContainer orientation="horizontal">
        <ReflexElement
          flex={0.85}
          minSize={100}
          className="bg-black text-gray-300"
        >
          <div className="fixed bg-black w-full z-10">
            <Nav initialData={initialData} />
          </div>
          <ReflexContainer
            orientation="vertical"
            className="h-full"
            style={{ paddingTop: '52px' }}
          >
            <ReflexElement className="left-pane" flex={0.6} minSize={100}>
              <SourceFileTabs />
              <GdbguiEditor />
            </ReflexElement>

            <ReflexSplitter className="" />

            <ReflexElement minSize={100}>
              <div className="pane-content">
                <RightSidebar
                  signals={initialData.signals}
                  debug={debug}
                  initialDir={initialData.working_directory}
                />
              </div>
            </ReflexElement>
          </ReflexContainer>
        </ReflexElement>

        <ReflexSplitter className="" />

        <ReflexElement minSize={10} className="pb-10">
          <ReflexContainer orientation="vertical">
            <ReflexElement minSize={20}>
              <GdbTerminal />
            </ReflexElement>

            <ReflexElement minSize={20} flex={0.3}>
              <InferiorTerminal />
            </ReflexElement>

            <ReflexElement minSize={20} flex={0.3}>
              <GdbGuiTerminal />
            </ReflexElement>
          </ReflexContainer>
        </ReflexElement>
      </ReflexContainer>
      <Footer />{' '}
    </div>
  )
}
