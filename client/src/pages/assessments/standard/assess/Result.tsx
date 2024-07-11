import React, { Key, useState } from 'react'
import { motion } from "framer-motion";
import {
    Card,
    CardHeader,
    CardBody,
    Input,
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Button,
    Tabs,
    Tab,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
} from "@nextui-org/react";
import { Clock4, Code, SquareStack } from "lucide-react";
import ResultBar from "./resultBar";

type ProgressOption = 'Coding' | 'MCQ';

const Result = () => {
    const codeResult = [
        {
            questionNo: 1,
            title: "Two Sum",
            timeTaken: "10m:32s",
            score: "18 out off 20",
        },
        {
            questionNo: 2,
            title: "Add Two Numbers",
            timeTaken: "10m:32s",
            score: "18 out off 20",
        },
        {
            questionNo: 3,
            title: "Longest Substring Without Repeating Characters",
            timeTaken: "10m:32s",
            score: "18 out off 20",
        },
        {
            questionNo: 4,
            title: "Median of Two Sorted Arrays",
            timeTaken: "10m:32s",
            score: "18 out off 20",
        },
        {
            questionNo: 5,
            title: "Longest Palindromic Substring",
            timeTaken: "10m:32s",
            score: "18 out off 20",
        },
    ]

    const [selectedOption, setSelectedOption] = useState<ProgressOption>('Coding');

    const handleSelectionChange = (key: Key) => {
        if (typeof key === 'string' && (key === 'Coding' || key === 'MCQ')) {
            setSelectedOption(key);
        }
    };


    return (
        <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full p-10 h-[100%] flex flex-row"
        >
            <div className="flex flex-col w-3/4 h-screen">
                <div className="flex justify-center gap-11 w-full flex-wrap">
                    <Card className="h-36 w-52">
                        <CardHeader className="flex flex-row gap-2 text-center justify-center text-gray-400">
                            <p>Time Taken</p>
                            <Clock4 size={28} className="text-blue-500" />
                        </CardHeader>
                        <CardBody className="flex justify-center items-start gap-5 flex-row">
                            <p className="text-xl"></p>
                        </CardBody>
                    </Card>
                    <Card className="h-36 w-52">
                        <CardHeader className="text-center flex flex-row gap-2 justify-center text-gray-400">
                            <p>Coding Completion</p>
                            <Code size={28} className="text-green-500" />
                        </CardHeader>
                        <CardBody className="flex justify-center items-start gap-5 flex-row">
                            <p className="text-xl"></p>
                        </CardBody>
                    </Card>
                    <Card className="h-36 w-52">
                        <CardHeader className="text-center flex flex-row gap-2 justify-center text-gray-400">
                            <p>MCQ Completion</p>
                            <SquareStack size={27} className="text-yellow-500" />
                        </CardHeader>
                        <CardBody className="flex justify-center items-start gap-5 flex-row">
                            <p className="text-xl"></p>
                        </CardBody>
                    </Card>
                </div>
                <div>
                    <div className="flex flex-row justify-center items-center pt-7 gap-9 w-full">
                        <Card className="h-44 w-[28%]">
                            <CardHeader className="text-left flex flex-row gap-2 justify-start text-gray-400 border-b-2">
                                <p>Assessments Results:</p>
                            </CardHeader>
                            <CardBody className="flex justify-center items-center gap-3 flex-col p-2">
                                <p className="text-sm">🌟 Congratulations on completing the assessment! 🌟</p>
                                <p className="text-sm">Based on your performance, here's your skill level:</p>
                                <p className="text-sm text-blue-500">Intermediate.🚀</p>
                            </CardBody>
                        </Card>
                        <Card className="h-44 w-53">
                            <CardHeader className="text-center flex flex-row gap-2 justify-center text-gray-400">
                                <p>Your Report Card</p>
                            </CardHeader>
                            <CardBody className="flex justify-center items-start gap-5 flex-row">
                                <ul className="list-disc ml-4 text-sm flex flex-col gap-3">
                                    <li><span className='text-blue-500 mr-1'>Time Taken:</span>10 mins</li>
                                    <li><span className='text-green-500 mr-1'>Coding Completion:</span>10 mins</li>
                                    <li><span className='text-yellow-500 mr-1'>MCQ Completion:</span>10 mins</li>
                                </ul>
                            </CardBody>
                        </Card>
                    </div>
                </div>
                <div className='flex justify-center items-center w-full pt-7'>
                    <Tabs aria-label="Options" className=''>
                        <Tab key="mcq" title="MCQs" className="">
                        </Tab>
                        <Tab key="coding" title="Coding" className="">
                            <Table isStriped aria-label="Code Results" className="pt-10">
                                <TableHeader>
                                    <TableColumn className="text-sm">Question No.</TableColumn>
                                    <TableColumn className="text-sm">Question</TableColumn>
                                    <TableColumn className="text-sm">Time Taken</TableColumn>
                                    <TableColumn className="text-sm">Score</TableColumn>
                                </TableHeader>
                                <TableBody>
                                    {codeResult.map((codeResult: any) => (
                                        <TableRow className="h-14" key={codeResult.questionNo}>
                                            <TableCell className="w-full md:w-auto">{codeResult.questionNo}</TableCell>
                                            <TableCell className="w-full md:w-auto">{codeResult.title}</TableCell>
                                            <TableCell className="w-full md:w-auto">{codeResult.timeTaken}</TableCell>
                                            <TableCell className="w-full md:w-auto">{codeResult.score}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Tab>
                    </Tabs>
                </div>
            </div>
            <div>
                <Card className="h-[50vh] w-[50vh] pt-2 rounded-2xl">
                    <CardHeader className="text-center flex flex-row gap-4 justify-center text-gray-400">
                        <p className="text-yellow-500">Your Progress</p>
                        <Dropdown className='w-12 h-12'>
                            <DropdownTrigger>
                                <Button variant="flat" className='w-11 h-9'>{selectedOption}</Button>
                            </DropdownTrigger>
                            <DropdownMenu
                                aria-label="Link Actions"
                                onAction={handleSelectionChange}
                            >
                                <DropdownItem key="Coding">
                                    Coding
                                </DropdownItem>
                                <DropdownItem key="MCQ">
                                    MCQ
                                </DropdownItem>
                            </DropdownMenu>
                        </Dropdown>
                    </CardHeader>
                    <CardBody className="flex justify-center items-start gap-3 flex-row">
                        {selectedOption === 'Coding' ? (
                            <div>Coding progress content goes here</div>
                        ) : (
                            <div>MCQ progress content goes here</div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </motion.div>
    )
}

export default Result;