import React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Button,
  Card,
  Divider,
  CardBody,
  CardHeader,
  CardFooter,
  Chip,
  Accordion,
  AccordionItem
} from "@heroui/react";
import { UserCircle, Send, Briefcase, Book, Award, FileBadge, Globe, Check, X, ChevronDown } from 'lucide-react';
import type { Candidate } from '@shared-types/Candidate';
import { useAuth } from "@/auth";
import ax from "@/config/axios";

interface PostingForForm {
  _id?: string;
  title: string;
  additionalDetails?: {
    [category: string]: {
      [field: string]: {
        required: boolean;
        allowEmpty: boolean;
      };
    };
  };
}

interface ApplicationFormProps {
  posting: PostingForForm;
  onClose: () => void;
  onSubmit: (formData: any) => Promise<void>;
}

interface FormField {
  value: string;
  error: string;
  touched: boolean;
  category: string;
}

interface FormState {
  [field: string]: FormField;
}

const SYSTEM_FIELDS = ['_id', '__v', 'createdAt', 'updatedAt'];

function ApplicationForm({ posting, onClose, onSubmit }: ApplicationFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [candidateData, setCandidateData] = useState<Candidate | null>(null);
  const [formState, setFormState] = useState<FormState>(() => {
    const initialState: FormState = {};

    if (posting.additionalDetails) {
      Object.entries(posting.additionalDetails).forEach(([category, fields]) => {
        if (SYSTEM_FIELDS.includes(category)) return;

        Object.entries(fields).forEach(([field, config]) => {
          if (SYSTEM_FIELDS.includes(field)) return;
          if (config.required || config.allowEmpty) {
            initialState[field] = {
              value: '',
              error: '',
              touched: false,
              category
            };
          }
        });
      });
    }

    return initialState;
  });

  const validateField = (field: string, value: string): string => {
    const fieldInfo = Object.entries(posting.additionalDetails || {}).find(([, fields]) => {
      return Object.keys(fields).includes(field);
    });

    if (!fieldInfo) return '';

    const [, fields] = fieldInfo;
    const fieldConfig = fields[field];

    if (fieldConfig.required && !fieldConfig.allowEmpty && !value.trim()) {
      return 'This field is required';
    }

    return '';
  };

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const fetchCandidateData = async () => {
    try {
      const response = await axios.get('/candidates/candidate');
      setCandidateData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch candidate data:', error);
    }
  };

  useEffect(() => {
    fetchCandidateData();
  }, []);

  const formatDateRange = (start: string, end?: string, current?: boolean) => {
    const startDate = new Date(start).toLocaleDateString();
    return current ? `${startDate} - Present` : end ? `${startDate} - ${new Date(end).toLocaleDateString()}` : startDate;
  };

  const getCategoryIcon = (category: string) => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('work') || lowerCategory.includes('experience')) return <Briefcase className="w-5 h-5" />;
    if (lowerCategory.includes('education')) return <Book className="w-5 h-5" />;
    if (lowerCategory.includes('certificate')) return <FileBadge className="w-5 h-5" />;
    if (lowerCategory.includes('award')) return <Award className="w-5 h-5" />;
    return <Globe className="w-5 h-5" />;
  };

  const renderArrayItems = (items: any[], renderItem: (item: any) => string) => {
    if (!items?.length) return <span className="text-default-400">Not provided</span>;

    return (
      <Accordion variant="bordered">
        {items.map((item, index) => (
          <AccordionItem
            key={index}
            title={
              <span className="text-small">
                Item {index + 1}
              </span>
            }
            indicator={<ChevronDown className="text-primary" />}
            className="bg-background/40"
          >
            <p className="text-default-600 whitespace-pre-wrap">
              {renderItem(item)}
            </p>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const autofillWithProfile = async () => {
    if (!candidateData) return;
    setIsLoading(true);

    try {
      const newFormState = { ...formState };

      Object.keys(formState).forEach(field => {
        const fieldLower = field.toLowerCase();
        let value = '';

        // Basic Information
        if (fieldLower.includes('name')) {
          value = candidateData.name || '';
        } else if (fieldLower.includes('email')) {
          value = candidateData.email || '';
        } else if (fieldLower.includes('phone')) {
          value = candidateData.phone || '';
        } else if (fieldLower.includes('address')) {
          value = candidateData.address || '';
        } else if (fieldLower.includes('summary') || fieldLower.includes('about')) {
          value = candidateData.summary || '';
        } else if (fieldLower.includes('gender')) {
          value = candidateData.gender || '';
        } else if (fieldLower.includes('dob') || fieldLower.includes('birthdate')) {
          value = candidateData.dob ? new Date(candidateData.dob).toISOString().split('T')[0] : '';
        }

        // Education
        else if (fieldLower.includes('education')) {
          const educations = candidateData.education || [];
          if (educations.length > 0) {
            value = educations.map(edu =>
              `${edu.degree} in ${edu.branch} from ${edu.school}\n` +
              `Board: ${edu.board}\n` +
              `Percentage: ${edu.percentage}%\n` +
              `Type: ${edu.type}`
            ).join('\n\n');
          }
        }

        // Work Experience
        else if (fieldLower.includes('experience') || fieldLower.includes('work')) {
          const experiences = candidateData.workExperience || [];
          if (experiences.length > 0) {
            value = experiences.map(exp =>
              `${exp.title} at ${exp.company}\n` +
              `Duration: ${formatDateRange(exp.startDate.toString(), exp.endDate?.toString(), exp.current)}\n` +
              `Location: ${exp.location}\n` +
              `Sector: ${exp.sector}\n` +
              `Type: ${exp.type}\n` +
              `Function: ${exp.jobFunction}\n` +
              `Description: ${exp.description || 'Not provided'}`
            ).join('\n\n');
          }
        }

        // Skills
        else if (fieldLower.includes('skill')) {
          if (fieldLower.includes('technical')) {
            const skills = candidateData.technicalSkills?.map(s => `${s.skill} (${s.proficiency})`).join('\n') || '';
            value = skills;
          } else {
            const allSkills = [
              ...(candidateData.technicalSkills || []),
              ...(candidateData.languages || []).map(l => ({ skill: l.language, proficiency: l.proficiency })),
              ...(candidateData.subjects || []).map(s => ({ skill: s.subject, proficiency: s.proficiency }))
            ].map(s => `${s.skill} (${s.proficiency})`).join('\n');
            value = allSkills;
          }
        }

        // Projects
        else if (fieldLower.includes('project')) {
          const projects = candidateData.projects || [];
          if (projects.length > 0) {
            value = projects.map(proj =>
              `${proj.title} (${proj.domain})\n` +
              `Description: ${proj.description}\n` +
              `URL: ${proj.url || 'Not provided'}`
            ).join('\n\n');
          }
        }

        // Awards
        else if (fieldLower.includes('award')) {
          const awards = candidateData.awards || [];
          if (awards.length > 0) {
            value = awards.map(award =>
              `${award.title} by ${award.issuer}\n` +
              `Description: ${award.description}`
            ).join('\n\n');
          }
        }

        // Certificates
        else if (fieldLower.includes('certification') || fieldLower.includes('certificate')) {
          const certificates = candidateData.certificates || [];
          if (certificates.length > 0) {
            value = certificates.map(cert =>
              `${cert.title} from ${cert.issuer}\n` +
              `${cert.hasScore && cert.score ? `Score: ${cert.score}\n` : ''}` +
              `License: ${cert.licenseNumber || 'Not provided'}\n` +
              `Description: ${cert.description || 'Not provided'}\n` +
              `URL: ${cert.url || 'Not provided'}`
            ).join('\n\n');
          }
        }

        // Languages
        else if (fieldLower.includes('language')) {
          const languages = candidateData.languages || [];
          value = languages.map(lang =>
            `${lang.language} (${lang.proficiency})`
          ).join('\n');
        }

        // Volunteering
        else if (fieldLower.includes('volunteer')) {
          const volunteerings = candidateData.volunteerings || [];
          if (volunteerings.length > 0) {
            value = volunteerings.map(vol =>
              `${vol.role} at ${vol.organization}\n` +
              `Cause: ${vol.cause}\n` +
              `Description: ${vol.description}`
            ).join('\n\n');
          }
        }

        // Social Links
        else if (fieldLower.includes('socialLinks') || fieldLower.includes('profile')) {
          const socialLinks = candidateData.socialLinks || [];
          value = socialLinks.map(link =>
            `${link.platform}: ${link.url}`
          ).join('\n');
        }

        if (value) {
          newFormState[field] = {
            ...formState[field],
            value,
            touched: true,
            error: validateField(field, value)
          };
        }
      });

      setFormState(newFormState);
    } catch (error) {
      console.error('Failed to autofill profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let hasErrors = false;
    const updatedFormState = { ...formState };

    Object.entries(formState).forEach(([field, data]) => {
      const error = validateField(field, data.value);
      if (error) {
        hasErrors = true;
        updatedFormState[field] = {
          ...data,
          error,
          touched: true
        };
      }
    });

    if (hasErrors) {
      setFormState(updatedFormState);
      setIsLoading(false);
      return;
    }

    try {
      const formData = Object.entries(formState).reduce((acc, [field, data]) => {
        const { category, value } = data;
        if (!acc[category]) {
          acc[category] = {};
        }
        acc[category][field] = value;
        return acc;
      }, {} as Record<string, Record<string, string>>);

      await onSubmit(formData);
    } catch (error) {
      console.error('Failed to submit application:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFieldValue = (field: string, value: string) => {
    if (!value) return <span className="text-default-400">Not provided</span>;

    const fieldLower = field.toLowerCase();

    // Handle fields that contain multiple items
    if (candidateData) {
      if (fieldLower.includes('education')) {
        return renderArrayItems(candidateData.education || [], (edu) =>
          `${edu.degree} in ${edu.branch} from ${edu.school}\n` +
          `Board: ${edu.board}\n` +
          `Percentage: ${edu.percentage}%\n` +
          `Type: ${edu.type}`
        );
      }
      if (fieldLower.includes('experience') || fieldLower.includes('work')) {
        return renderArrayItems(candidateData.workExperience || [], (exp) =>
          `${exp.title} at ${exp.company}\n` +
          `Duration: ${formatDateRange(exp.startDate, exp.endDate, exp.current)}\n` +
          `Location: ${exp.location}\n` +
          `Sector: ${exp.sector}\n` +
          `Type: ${exp.type}\n` +
          `Function: ${exp.jobFunction}\n` +
          `Description: ${exp.description || 'Not provided'}`
        );
      }
      if (fieldLower.includes('project')) {
        return renderArrayItems(candidateData.projects || [], (proj) =>
          `${proj.title} (${proj.domain})\n` +
          `Description: ${proj.description}\n` +
          `URL: ${proj.url || 'Not provided'}`
        );
      }
      if (fieldLower.includes('award')) {
        return renderArrayItems(candidateData.awards || [], (award) =>
          `${award.title} by ${award.issuer}\n` +
          `Description: ${award.description}`
        );
      }
      if (fieldLower.includes('certification') || fieldLower.includes('certificate')) {
        return renderArrayItems(candidateData.certificates || [], (cert) =>
          `${cert.title} from ${cert.issuer}\n` +
          `${cert.hasScore && cert.score ? `Score: ${cert.score}\n` : ''}` +
          `License: ${cert.licenseNumber || 'Not provided'}\n` +
          `Description: ${cert.description || 'Not provided'}\n` +
          `URL: ${cert.url || 'Not provided'}`
        );
      }
      if (fieldLower.includes('language')) {
        return renderArrayItems(candidateData.languages || [], (lang) =>
          `${lang.language} (${lang.proficiency})`
        );
      }
      if (fieldLower.includes('volunteer')) {
        return renderArrayItems(candidateData.volunteerings || [], (vol) =>
          `${vol.role} at ${vol.organization}\n` +
          `Cause: ${vol.cause}\n` +
          `Description: ${vol.description}`
        );
      }
      if (fieldLower.includes('socialLinks') || fieldLower.includes('profile')) {
        return renderArrayItems(candidateData.socialLinks || [], (link) =>
          `${link.platform}: ${link.url}`
        );
      }
    }

    // Default rendering for other fields
    if (fieldLower.includes('description')) {
      return <p className="whitespace-pre-wrap text-default-600">{value}</p>;
    }

    if (fieldLower.includes('url') || fieldLower.includes('link')) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          {value}
        </a>
      );
    }

    return <span className="text-default-600">{value}</span>;
  };

  const groupFieldsByCategory = () => {
    const groups: Record<string, Array<{ field: string; config: any }>> = {};

    Object.entries(posting.additionalDetails || {}).forEach(([category, fields]) => {
      if (SYSTEM_FIELDS.includes(category)) return;

      if (!groups[category]) {
        groups[category] = [];
      }

      Object.entries(fields).forEach(([field, config]) => {
        if (!SYSTEM_FIELDS.includes(field) && (config.required || config.allowEmpty)) {
          groups[category].push({ field, config });
        }
      });
    });

    return groups;
  };

  return (
    (<AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-7xl mx-auto px-4 py-6"
      >
        <Card className="bg-gradient-to-br from-background to-background/40 backdrop-blur-sm border border-white/10 shadow-2xl">
          <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-8">
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {posting.title}
              </h2>
              <p className="text-default-500 mt-2">Review your application details below</p>
            </div>
            <Button
              color="primary"
              variant="shadow"
              startContent={<UserCircle className="w-5 h-5" />}
              onPress={autofillWithProfile}
              isLoading={isLoading}
              className="w-full md:w-auto"
              size="lg"
            >
              Autofill with Profile
            </Button>
          </CardHeader>

          <Divider />

          <CardBody className="p-8">
            <div className="space-y-8">
              {Object.entries(groupFieldsByCategory()).map(([category, fields], categoryIndex) => (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: categoryIndex * 0.1 }}
                >
                  <Card className="bg-default-50/50 shadow-md">
                    <CardHeader className="flex gap-3 items-center p-5">
                      {getCategoryIcon(category)}
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold">
                          {category.charAt(0).toUpperCase() + category.slice(1).split(/(?=[A-Z])/).join(' ')}
                        </h3>
                        <p className="text-small text-default-500">
                          {fields.length} field{fields.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {fields.every(({ field }) => formState[field].value && !formState[field].error) ? (
                          <Chip
                            startContent={<Check className="w-4 h-4" />}
                            color="success"
                            variant="flat"
                          >
                            Complete
                          </Chip>
                        ) : (
                          <Chip
                            startContent={<X className="w-4 h-4" />}
                            color="danger"
                            variant="flat"
                          >
                            Incomplete
                          </Chip>
                        )}
                      </div>
                    </CardHeader>
                    <Divider />
                    <CardBody className="p-5 space-y-6">
                      {fields.map(({ field, config }, fieldIndex) => {
                        const formField = formState[field];
                        const isRequired = config.required && !config.allowEmpty;
                        const isRecommended = config.required && config.allowEmpty;

                        return (
                          (<motion.div
                            key={field}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: fieldIndex * 0.05 }}
                          >
                            <Card className="bg-background/60">
                              <CardBody className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-sm font-medium text-default-700">
                                    {field.split(/(?=[A-Z])/).map(word =>
                                      word.charAt(0).toUpperCase() + word.slice(1)
                                    ).join(' ')}
                                  </label>
                                  <div className="flex gap-2">
                                    {isRequired && (
                                      <Chip size="sm" color="danger" variant="flat">Required</Chip>
                                    )}
                                    {isRecommended && (
                                      <Chip size="sm" color="warning" variant="flat">Recommended</Chip>
                                    )}
                                    {formField.value && !formField.error && (
                                      <Chip size="sm" color="success" variant="flat">
                                        <Check className="w-3 h-3" />
                                      </Chip>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 min-h-[2rem]">
                                  {renderFieldValue(field, formField.value)}
                                </div>
                                {formField.error && formField.touched && (
                                  <p className="text-danger text-xs mt-2">{formField.error}</p>
                                )}
                              </CardBody>
                            </Card>
                          </motion.div>)
                        );
                      })}
                    </CardBody>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardBody>

          <Divider />

          <CardFooter className="flex flex-col sm:flex-row justify-end gap-4 p-8">
            <Button
              variant="flat"
              color="danger"
              onPress={onClose}
              size="lg"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              color="primary"
              startContent={<Send className="w-5 h-5" />}
              onClick={handleSubmit}
              isLoading={isLoading}
              size="lg"
              className="w-full sm:w-auto shadow-lg"
            >
              Submit Application
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </AnimatePresence>)
  );
}

export default ApplicationForm;